-- ═══════════════════════════════════════════════════════════════
-- 058 — Signalements : droits de consultation (lot 1)
--
-- Personne ne voit un signalement par défaut. La visibilité découle :
--   1. de la fonction de la personne (profiles.job_title) ;
--   2. de la matrice fonction × action de SA commune (ticket_matrice,
--      réglée par le super-admin) ;
--   3. des services auxquels elle appartient (portée « son service ») ;
--   4. du niveau de confidentialité du signalement et de ses
--      destinataires nommés.
-- Créateur, assignés et destinataires voient toujours le signalement
-- (sauf fonction réglée sur « rien »). Super-admin : tout.
--
-- La règle est écrite deux fois, à l'identique :
--   SQL `user_voit_ticket()` (RLS, temps réel) et
--   TS  `peutVoirTicket()` (lectures serveur en service role,
--   src/lib/tickets/droits.ts).
--
-- Mise en service sans rupture : les communes où le module est déjà
-- actif reçoivent une matrice « compatibilité » (toute la commune voit
-- les signalements standard, comme avant). Les autres communes, et
-- toute nouvelle commune, reçoivent la matrice par défaut.
--
-- Idempotente. Retour arrière : supabase/rollback/058_tickets_droits_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Nouvelles fonctions ──────────────────────────────────────
do $$
begin
  alter table public.profiles drop constraint if exists profiles_job_title_check;
  alter table public.profiles add constraint profiles_job_title_check
    check (job_title is null or job_title in (
      'maire', 'adjoint', 'conseiller', 'dgs', 'dst',
      'secretaire', 'responsable_service', 'agent', 'agent_technique', 'accueil',
      'associatif', 'citoyen', 'autre'
    ));
end$$;

-- Ligne de la matrice correspondant à une fonction
create or replace function public.ticket_fonction(p_job_title text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_job_title in ('maire', 'adjoint', 'conseiller', 'dgs', 'dst', 'secretaire', 'responsable_service', 'accueil')
      then p_job_title
    when p_job_title in ('agent', 'agent_technique') then 'agent'
    else 'autre'
  end
$$;

-- ─── 2. Services de la commune ───────────────────────────────────
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  commune_id  uuid not null references public.communes(id) on delete cascade,
  nom         text not null check (btrim(nom) <> ''),
  couleur     text,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id) on delete set null
);
create index if not exists idx_services_commune on public.services(commune_id) where deleted_at is null;
create unique index if not exists ux_services_commune_nom
  on public.services(commune_id, lower(btrim(nom))) where deleted_at is null;

create table if not exists public.service_membres (
  service_id  uuid not null references public.services(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (service_id, profile_id)
);
create index if not exists idx_service_membres_profile on public.service_membres(profile_id);

-- ─── 3. Matrice fonction × action, par commune ───────────────────
create table if not exists public.ticket_matrice (
  commune_id       uuid not null references public.communes(id) on delete cascade,
  fonction         text not null check (fonction in (
                     'maire', 'dgs', 'secretaire', 'dst', 'adjoint', 'conseiller',
                     'responsable_service', 'agent', 'accueil', 'autre')),
  voit             text not null default 'rien' check (voit in ('rien', 'siens', 'service', 'commune')),
  voit_restreints  boolean not null default false,
  -- { creer, modifier, assigner, changer_service, cloturer, rouvrir,
  --   commenter, changer_visibilite, exporter } : 'oui' | 'non' | 'si_assigne'
  actions          jsonb not null default '{}'::jsonb,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null,
  primary key (commune_id, fonction)
);

-- Matrice par défaut (miroir de MATRICE_DEFAUT, src/lib/tickets/droits.ts)
-- et matrice « compatibilité » (miroir de MATRICE_COMPAT).
create or replace function public.ticket_matrice_seed(p_commune uuid, p_compat boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  tout  jsonb := '{"creer":"oui","modifier":"oui","assigner":"oui","changer_service":"oui","cloturer":"oui","rouvrir":"oui","commenter":"oui","changer_visibilite":"oui","exporter":"oui"}';
  rien  jsonb := '{"creer":"non","modifier":"non","assigner":"non","changer_service":"non","cloturer":"non","rouvrir":"non","commenter":"non","changer_visibilite":"non","exporter":"non"}';
  compat jsonb := '{"creer":"oui","modifier":"oui","assigner":"oui","changer_service":"oui","cloturer":"oui","rouvrir":"oui","commenter":"oui","changer_visibilite":"non","exporter":"oui"}';
begin
  if p_compat then
    insert into public.ticket_matrice (commune_id, fonction, voit, voit_restreints, actions) values
      (p_commune, 'maire',               'commune', true,  tout),
      (p_commune, 'dgs',                 'commune', true,  tout),
      (p_commune, 'secretaire',          'commune', true,  tout),
      (p_commune, 'dst',                 'commune', true,  tout),
      (p_commune, 'adjoint',             'commune', false, compat),
      (p_commune, 'conseiller',          'commune', false, compat),
      (p_commune, 'responsable_service', 'commune', false, compat),
      (p_commune, 'agent',               'commune', false, compat),
      (p_commune, 'accueil',             'commune', false, compat),
      (p_commune, 'autre',               'commune', false, compat)
    on conflict (commune_id, fonction) do nothing;
  else
    insert into public.ticket_matrice (commune_id, fonction, voit, voit_restreints, actions) values
      (p_commune, 'maire',               'commune', true,  tout),
      (p_commune, 'dgs',                 'commune', true,  tout),
      (p_commune, 'secretaire',          'commune', true,  tout),
      (p_commune, 'dst',                 'commune', true,  tout),
      (p_commune, 'adjoint',             'service', false, rien || '{"creer":"oui","commenter":"oui","exporter":"oui"}'),
      (p_commune, 'conseiller',          'siens',   false, rien || '{"creer":"oui","commenter":"oui"}'),
      (p_commune, 'responsable_service', 'service', false, tout),
      (p_commune, 'agent',               'service', false, rien || '{"creer":"oui","modifier":"si_assigne","assigner":"si_assigne","cloturer":"si_assigne","commenter":"oui"}'),
      (p_commune, 'accueil',             'siens',   false, rien || '{"creer":"oui","commenter":"oui"}'),
      (p_commune, 'autre',               'rien',    false, rien)
    on conflict (commune_id, fonction) do nothing;
  end if;
end $$;
revoke all on function public.ticket_matrice_seed(uuid, boolean) from public, anon, authenticated;

-- Toute nouvelle commune reçoit la matrice par défaut
create or replace function public.tg_communes_ticket_matrice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ticket_matrice_seed(new.id, false);
  return new;
end $$;
drop trigger if exists trg_communes_ticket_matrice on public.communes;
create trigger trg_communes_ticket_matrice
  after insert on public.communes
  for each row execute function public.tg_communes_ticket_matrice();

-- Communes existantes : compatibilité si le module est déjà actif
do $$
declare c record;
begin
  for c in select id from public.communes loop
    perform public.ticket_matrice_seed(
      c.id,
      exists (select 1 from public.commune_modules cm where cm.commune_id = c.id and cm.module_id = 'tickets')
    );
  end loop;
end $$;

-- ─── 4. Confidentialité, service et destinataires des signalements ─
alter table public.tickets
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists confidentialite text not null default 'standard';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_confidentialite_check') then
    alter table public.tickets add constraint tickets_confidentialite_check
      check (confidentialite in ('standard', 'restreint', 'confidentiel'));
  end if;
end $$;
create index if not exists idx_tickets_service on public.tickets(service_id);

create table if not exists public.ticket_destinataires (
  ticket_id   uuid not null references public.tickets(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  ajoute_par  uuid references public.profiles(id) on delete set null,
  ajoute_le   timestamptz not null default now(),
  primary key (ticket_id, profile_id)
);
create index if not exists idx_ticket_destinataires_profile on public.ticket_destinataires(profile_id);

-- ─── 5. Règle de visibilité (miroir de peutVoirTicket) ───────────
create or replace function public.user_voit_ticket(p_ticket uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text; v_commune uuid; v_job text;
  t record; l record;
begin
  if v_uid is null then return false; end if;
  select role, commune_id, job_title into v_role, v_commune, v_job from public.profiles where id = v_uid;
  if v_role = 'super_admin' then return true; end if;
  if v_role is null or v_role not in ('admin', 'editor') then return false; end if;

  select id, commune_id, created_by, assigne_a, service_id, confidentialite
    into t from public.tickets where id = p_ticket;
  if not found or t.commune_id is distinct from v_commune then return false; end if;

  select voit, voit_restreints into l
    from public.ticket_matrice
   where commune_id = t.commune_id and fonction = public.ticket_fonction(v_job);
  if not found or l.voit = 'rien' then return false; end if;

  if t.created_by = v_uid or t.assigne_a = v_uid
     or exists (select 1 from public.ticket_assignees a where a.ticket_id = p_ticket and a.profile_id = v_uid)
     or exists (select 1 from public.ticket_destinataires d where d.ticket_id = p_ticket and d.profile_id = v_uid)
  then
    return true;
  end if;

  if t.confidentialite = 'confidentiel' then return false; end if;
  if t.confidentialite = 'restreint' then return l.voit_restreints; end if;
  if l.voit = 'commune' then return true; end if;
  if l.voit = 'service' then
    return t.service_id is not null and exists (
      select 1 from public.service_membres sm
        join public.services s on s.id = sm.service_id and s.deleted_at is null
       where sm.service_id = t.service_id and sm.profile_id = v_uid
    );
  end if;
  return false;
end $$;
revoke all on function public.user_voit_ticket(uuid) from public, anon;
grant execute on function public.user_voit_ticket(uuid) to authenticated;
revoke all on function public.ticket_fonction(text) from public, anon;
grant execute on function public.ticket_fonction(text) to authenticated;

-- ─── 6. RLS : la visibilité s'applique aussi aux lectures avec la clé
--     utilisateur (temps réel notamment). Les écritures applicatives
--     passent par le service role ; les droits d'action (matrice) sont
--     vérifiés côté serveur.
drop policy if exists "tickets_select_own_commune" on public.tickets;
drop policy if exists "tickets_select_visible" on public.tickets;
create policy "tickets_select_visible"
  on public.tickets for select
  using (public.user_voit_ticket(id));

drop policy if exists "tickets_update_admin_or_assigne" on public.tickets;
create policy "tickets_update_admin_or_assigne"
  on public.tickets for update
  using (
    public.user_voit_ticket(id)
    and (
      public.my_role() in ('admin', 'super_admin')
      or assigne_a = auth.uid()
      or created_by = auth.uid()
    )
  );

drop policy if exists "ticket_photos_select" on public.ticket_photos;
create policy "ticket_photos_select"
  on public.ticket_photos for select
  using (public.user_voit_ticket(ticket_id));

drop policy if exists "ticket_photos_insert" on public.ticket_photos;
create policy "ticket_photos_insert"
  on public.ticket_photos for insert
  with check (public.user_voit_ticket(ticket_id));

drop policy if exists "ticket_comments_select" on public.ticket_commentaires;
create policy "ticket_comments_select"
  on public.ticket_commentaires for select
  using (public.user_voit_ticket(ticket_id));

drop policy if exists "ticket_comments_insert" on public.ticket_commentaires;
create policy "ticket_comments_insert"
  on public.ticket_commentaires for insert
  with check (public.user_voit_ticket(ticket_id));

drop policy if exists "ticket_rapports_select" on public.ticket_rapports;
create policy "ticket_rapports_select"
  on public.ticket_rapports for select
  using (public.user_voit_ticket(ticket_id));

drop policy if exists "ticket_assignees_select" on public.ticket_assignees;
create policy "ticket_assignees_select"
  on public.ticket_assignees for select
  using (public.user_voit_ticket(ticket_id));

alter table public.services             enable row level security;
alter table public.service_membres      enable row level security;
alter table public.ticket_matrice       enable row level security;
alter table public.ticket_destinataires enable row level security;

drop policy if exists "services_select_commune" on public.services;
create policy "services_select_commune"
  on public.services for select
  using (public.user_can_access_commune(commune_id));

drop policy if exists "service_membres_select_commune" on public.service_membres;
create policy "service_membres_select_commune"
  on public.service_membres for select
  using (exists (
    select 1 from public.services s
     where s.id = service_id and public.user_can_access_commune(s.commune_id)
  ));

drop policy if exists "ticket_matrice_select_commune" on public.ticket_matrice;
create policy "ticket_matrice_select_commune"
  on public.ticket_matrice for select
  using (public.user_can_access_commune(commune_id));

drop policy if exists "ticket_destinataires_select" on public.ticket_destinataires;
create policy "ticket_destinataires_select"
  on public.ticket_destinataires for select
  using (public.user_voit_ticket(ticket_id));
-- Aucune policy d'écriture : services, membres, matrice et destinataires
-- ne s'écrivent que par le service role, après contrôle des droits.

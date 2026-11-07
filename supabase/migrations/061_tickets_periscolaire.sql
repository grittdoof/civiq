-- ═══════════════════════════════════════════════════════════════
-- 061 — Signalements : ouverture au périscolaire (lot 5)
--
-- • `sites` : écoles, accueils de loisirs, restaurants scolaires… de la
--   commune (réutilisable pour les bâtiments).
-- • `ticket_periscolaire` : précisions d'un signalement périscolaire
--   (site, créneau, enfant concerné facultatif, famille informée). Table
--   séparée : RLS dédiée (`user_voit_ticket`) et effacement ciblé.
-- • `ticket_categories.notifier_fonctions` : fonctions prévenues et
--   nommées destinataires à la création (remontée automatique). Seed :
--   « Incident enfant » → maire, DGS, secrétaire générale.
-- • Service « Périscolaire » créé pour les communes équipées du module
--   s'il n'existe pas, et proposé par défaut pour la catégorie.
-- • Minimisation (RGPD art. 5 ; repère CNIL NS-058) : le champ « enfant »
--   est effacé automatiquement. Par défaut, le 31 août qui suit la
--   clôture (fin de l'année scolaire en cours) ; une commune peut fixer un
--   nombre de mois après la clôture (`tickets_effacement_enfant_mois`).
--   `purger_donnees_enfants()` (service role, tâche quotidienne).
--
-- Additive et idempotente. Retour arrière :
-- supabase/rollback/061_tickets_periscolaire_down.sql
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  commune_id  uuid not null references public.communes(id) on delete cascade,
  nom         text not null check (btrim(nom) <> ''),
  type        text not null default 'ecole' check (type in ('ecole', 'accueil_loisirs', 'restauration', 'batiment', 'autre')),
  adresse     text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_sites_commune on public.sites(commune_id) where deleted_at is null;
alter table public.sites enable row level security;
drop policy if exists "sites_select_commune" on public.sites;
create policy "sites_select_commune" on public.sites for select using (public.user_can_access_commune(commune_id));

create table if not exists public.ticket_periscolaire (
  ticket_id            uuid primary key references public.tickets(id) on delete cascade,
  site_id              uuid references public.sites(id) on delete set null,
  creneau              text check (creneau in ('matin', 'midi', 'soir', 'mercredi', 'vacances')),
  enfant               text check (enfant is null or char_length(enfant) <= 80),
  famille_informee     boolean,
  famille_informee_le  date,
  donnees_purgees_le   timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists idx_ticket_periscolaire_site on public.ticket_periscolaire(site_id);
alter table public.ticket_periscolaire enable row level security;
drop policy if exists "ticket_periscolaire_select" on public.ticket_periscolaire;
create policy "ticket_periscolaire_select" on public.ticket_periscolaire for select using (public.user_voit_ticket(ticket_id));
-- Écritures : service role uniquement.

alter table public.ticket_categories
  add column if not exists notifier_fonctions text[];
update public.ticket_categories
   set notifier_fonctions = array['maire', 'dgs', 'secretaire']
 where code = 'incident_enfant' and notifier_fonctions is null;

-- Nouvelles communes : même remontée sur « Incident enfant »
create or replace function public.tg_communes_ticket_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ticket_categories_seed(new.id);
  update public.ticket_categories set notifier_fonctions = array['maire', 'dgs', 'secretaire']
   where commune_id = new.id and code = 'incident_enfant' and notifier_fonctions is null;
  return new;
end $$;

alter table public.commune_settings
  add column if not exists tickets_effacement_enfant_mois integer
    check (tickets_effacement_enfant_mois is null or tickets_effacement_enfant_mois between 1 and 36);

-- Service « Périscolaire » pour les communes équipées, proposé par défaut
do $$
declare c record; v_service uuid;
begin
  for c in select cm.commune_id from public.commune_modules cm where cm.module_id = 'tickets' loop
    select id into v_service from public.services
     where commune_id = c.commune_id and deleted_at is null and lower(btrim(nom)) = 'périscolaire';
    if v_service is null then
      insert into public.services (commune_id, nom, ordre)
      values (c.commune_id, 'Périscolaire',
              coalesce((select max(ordre) from public.services where commune_id = c.commune_id), 0) + 1)
      returning id into v_service;
    end if;
    update public.ticket_categories
       set service_defaut_id = v_service
     where commune_id = c.commune_id and code = 'periscolaire' and parent_id is null
       and service_defaut_id is null and deleted_at is null;
  end loop;
end $$;

-- Date d'effacement (miroir de dateEffacementEnfant, src/lib/tickets/periscolaire.ts)
create or replace function public.date_effacement_enfant(p_clos timestamptz, p_mois integer)
returns timestamptz language sql immutable as $$
  select case
    when p_clos is null then null
    when p_mois is not null then p_clos + make_interval(months => p_mois)
    else make_timestamptz(
           extract(year from p_clos at time zone 'Europe/Paris')::int
             + case when extract(month from p_clos at time zone 'Europe/Paris') >= 9 then 1 else 0 end,
           8, 31, 23, 59, 59, 'Europe/Paris')
  end
$$;

create or replace function public.purger_donnees_enfants()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.ticket_periscolaire tp
     set enfant = null, donnees_purgees_le = now()
    from public.tickets t
    left join public.commune_settings cs on cs.commune_id = t.commune_id
   where tp.ticket_id = t.id
     and tp.enfant is not null
     and t.statut in ('resolu', 'clos', 'annule', 'converti_en_projet')
     and public.date_effacement_enfant(coalesce(t.clos_at, t.resolu_at, t.updated_at), cs.tickets_effacement_enfant_mois) < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purger_donnees_enfants() from public, anon, authenticated;
revoke all on function public.date_effacement_enfant(timestamptz, integer) from public, anon;

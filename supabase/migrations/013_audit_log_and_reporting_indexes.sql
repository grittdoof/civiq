-- ═══════════════════════════════════════════════════════════════
-- Migration 013 — Audit log + index reporting
--
-- 1. Table audit_log : traçabilité fine des actions sensibles
--    (suppression, changement de rôle, assignation, clôture…)
-- 2. Index manquants pour le reporting tickets
-- 3. RPC log_audit() utilisable depuis les server actions
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Table audit_log ────────────────────────────────────────
create table if not exists public.audit_log (
  id            bigserial primary key,
  commune_id    uuid references public.communes(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_email  text,                              -- snapshot, résiste au RGPD oubli
  actor_role   text,                              -- snapshot
  action       text not null,                     -- ex: ticket.assigned, survey.deleted
  target_type  text not null,                     -- ex: ticket, survey, profile
  target_id    uuid,                              -- ID de l'entité touchée
  metadata     jsonb,                             -- payload contextuel
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_log_commune     on public.audit_log(commune_id, created_at desc);
create index if not exists idx_audit_log_actor       on public.audit_log(actor_id, created_at desc);
create index if not exists idx_audit_log_target      on public.audit_log(target_type, target_id);
create index if not exists idx_audit_log_action_date on public.audit_log(action, created_at desc);

alter table public.audit_log enable row level security;

-- Lecture : super-admin partout, admin de la commune sur sa commune
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin"
  on public.audit_log for select
  using (
    public.my_role() = 'super_admin'
    or (
      public.my_role() = 'admin'
      and commune_id is not null
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.commune_id = audit_log.commune_id
      )
    )
  );

-- Écriture : seulement via service role (côté serveur) ou super-admin
drop policy if exists "audit_log_insert_service" on public.audit_log;
create policy "audit_log_insert_service"
  on public.audit_log for insert
  with check (public.my_role() = 'super_admin');

-- Pas d'update ni delete : un audit log est immuable.

-- ─── 2. RPC log_audit() helper ──────────────────────────────────
create or replace function public.log_audit(
  p_action      text,
  p_target_type text,
  p_target_id   uuid default null,
  p_commune_id  uuid default null,
  p_metadata    jsonb default null
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_actor_id    uuid := auth.uid();
  v_actor_email text;
  v_actor_role  text;
  v_id          bigint;
begin
  if v_actor_id is not null then
    select au.email, p.role into v_actor_email, v_actor_role
      from public.profiles p
 left join auth.users au on au.id = p.id
     where p.id = v_actor_id;
  end if;

  insert into public.audit_log (
    commune_id, actor_id, actor_email, actor_role,
    action, target_type, target_id, metadata
  ) values (
    p_commune_id, v_actor_id, v_actor_email, v_actor_role,
    p_action, p_target_type, p_target_id, p_metadata
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_audit(text, text, uuid, uuid, jsonb) to authenticated, service_role;

-- ─── 3. Index manquants pour le reporting tickets ──────────────
create index if not exists idx_tickets_resolu_at
  on public.tickets(commune_id, resolu_at)
  where resolu_at is not null;

create index if not exists idx_tickets_echeance
  on public.tickets(commune_id, echeance)
  where echeance is not null and statut not in ('clos', 'annule');

create index if not exists idx_tickets_canal_created
  on public.tickets(commune_id, canal, created_at desc);

create index if not exists idx_ticket_comments_recent
  on public.ticket_commentaires(ticket_id, created_at desc);

-- ─── 4. Vue reporting (lecture facile depuis le dashboard) ─────
-- NB : la table `tickets` n'a pas de soft-delete (seul `deleteTicketHard`
-- pour les super-admins). Pas de filtre deleted_at à appliquer.
create or replace view public.tickets_reporting_v as
  select
    t.commune_id,
    t.id,
    t.numero,
    t.titre,
    t.categorie,
    t.priorite,
    t.statut,
    t.canal,
    t.assigne_a,
    t.created_by,
    t.created_at,
    t.assigne_at,
    t.pris_en_charge_at,
    t.resolu_at,
    t.clos_at,
    t.echeance,
    -- Délai de traitement en heures (création → résolution)
    case
      when t.resolu_at is not null
      then extract(epoch from (t.resolu_at - t.created_at)) / 3600
      else null
    end as delai_resolution_h,
    -- En retard ?
    case
      when t.echeance is not null
        and t.echeance < current_date
        and t.statut not in ('clos', 'annule', 'resolu')
      then true else false
    end as en_retard,
    -- Réouvert ? (≥ 1 transition resolu → en_cours/pris_en_charge dans les commentaires système)
    (
      select count(*) > 0
        from public.ticket_commentaires c
       where c.ticket_id = t.id
         and c.is_systeme = true
         and c.contenu like 'Statut : resolu → %'
    ) as a_ete_reouvert
  from public.tickets t;

grant select on public.tickets_reporting_v to authenticated;

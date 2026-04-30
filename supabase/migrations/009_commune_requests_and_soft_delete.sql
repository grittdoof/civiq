-- ═══════════════════════════════════════════════════════════════
-- Migration 009 — Demandes de rattachement + soft-delete + RBAC
--
-- 1. commune_requests : table des demandes utilisateurs
--    - join : « je veux rejoindre une commune existante »
--    - create : « je veux créer cette commune »
--    Statuts : pending / approved / rejected
--
-- 2. surveys.deleted_at + responses.deleted_at : soft-delete
--    avec restauration possible (corbeille).
--    Index partial sur les lignes vivantes pour perfs lecture.
--
-- 3. Vue audit_log_recent : journal des suppressions
--    (utile pour un super-admin curieux).
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Table des demandes de rattachement ───
create table if not exists public.commune_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  request_type    text not null check (request_type in ('join', 'create')),
  -- Cas 'join' : on cible une commune existante
  commune_id      uuid references public.communes(id) on delete cascade,
  -- Cas 'create' : on stocke les infos saisies (créées à l'approbation)
  proposed_name        text,
  proposed_code_postal text,
  proposed_email       text,
  -- Rôle souhaité (admin si je crée, sinon editor par défaut)
  requested_role  text default 'editor' check (requested_role in ('admin', 'editor', 'viewer')),
  -- Mot du demandeur
  message         text,
  -- Workflow
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  rejection_reason text,
  -- Métadonnées
  created_at      timestamptz default now()
);

-- Une seule demande PENDING par user à la fois (partial unique index)
create unique index if not exists idx_unique_pending_request_per_user
  on public.commune_requests(user_id)
  where status = 'pending';

create index if not exists idx_commune_requests_status   on public.commune_requests(status);
create index if not exists idx_commune_requests_user     on public.commune_requests(user_id);
create index if not exists idx_commune_requests_commune  on public.commune_requests(commune_id);

alter table public.commune_requests enable row level security;

drop policy if exists "Users see their own requests" on public.commune_requests;
create policy "Users see their own requests"
  on public.commune_requests for select
  using (user_id = auth.uid() or public.my_role() = 'super_admin');

drop policy if exists "Users create their own requests" on public.commune_requests;
create policy "Users create their own requests"
  on public.commune_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "Super-admins manage requests" on public.commune_requests;
create policy "Super-admins manage requests"
  on public.commune_requests for update
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

drop policy if exists "Super-admins delete requests" on public.commune_requests;
create policy "Super-admins delete requests"
  on public.commune_requests for delete
  using (public.my_role() = 'super_admin');

-- ─── 2. Soft-delete sur surveys ───
alter table public.surveys
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists idx_surveys_alive
  on public.surveys(commune_id)
  where deleted_at is null;

-- ─── 3. Soft-delete sur responses ───
alter table public.responses
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

create index if not exists idx_responses_alive
  on public.responses(survey_id)
  where deleted_at is null;

-- ─── 4. Helpers RBAC pour le module sondage ───
-- Lecture : viewer+ (tout user authentifié de la commune)
-- Édition : editor+ (admin, editor)
-- Création/Suppression : admin+ (admin, super_admin)
create or replace function public.can_create_survey() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'super_admin')
$$;

create or replace function public.can_edit_survey() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'editor', 'super_admin')
$$;

create or replace function public.can_delete_survey() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin', 'super_admin')
$$;

grant execute on function public.can_create_survey()  to authenticated;
grant execute on function public.can_edit_survey()    to authenticated;
grant execute on function public.can_delete_survey()  to authenticated;

-- ─── 5. Vue : éléments dans la corbeille (super-admin friendly) ───
create or replace view public.surveys_trash as
  select s.id, s.title, s.slug, s.commune_id, c.name as commune_name,
         s.deleted_at, s.deleted_by,
         (select count(*) from public.responses r
            where r.survey_id = s.id and r.deleted_at is null) as live_response_count
  from public.surveys s
  left join public.communes c on c.id = s.commune_id
  where s.deleted_at is not null
  order by s.deleted_at desc;

-- ─── 6. RPC : purger les soft-deletes anciens (>30j) ───
-- À planifier en cron Supabase si souhaité.
create or replace function public.purge_old_soft_deletes()
returns table (surveys_purged integer, responses_purged integer)
language plpgsql security definer set search_path = public as $$
declare
  s_count integer;
  r_count integer;
begin
  delete from public.surveys
   where deleted_at is not null
     and deleted_at < now() - interval '30 days';
  get diagnostics s_count = row_count;

  delete from public.responses
   where deleted_at is not null
     and deleted_at < now() - interval '30 days';
  get diagnostics r_count = row_count;

  return query select s_count, r_count;
end;
$$;

grant execute on function public.purge_old_soft_deletes() to service_role;

-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Ajout job_title (profil fonctionnel) + archivage commune
--
-- - profiles.job_title : classification fonctionnelle (adjoint,
--   conseiller, agent, etc.) distincte du rôle technique
-- - communes.archived_at : soft-delete des communes
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Job title sur profiles ───
alter table public.profiles
  add column if not exists job_title text;

-- Check contraint : valeurs autorisées
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_job_title_check'
  ) then
    alter table public.profiles
      add constraint profiles_job_title_check
      check (job_title is null or job_title in (
        'maire',
        'adjoint',
        'conseiller',
        'dgs',
        'secretaire',
        'agent',
        'citoyen',
        'autre'
      ));
  end if;
end $$;

-- ─── 2. Soft-delete commune ───
alter table public.communes
  add column if not exists archived_at timestamptz;

create index if not exists idx_communes_archived_at
  on public.communes(archived_at);

-- ─── 3. Vue commune_stats enrichie (exclut archivées) ───
create or replace view public.commune_stats as
select
  c.id, c.name, c.slug, c.code_postal, c.created_at, c.archived_at,
  (select count(*) from public.profiles        where commune_id = c.id) as user_count,
  (select count(*) from public.surveys         where commune_id = c.id) as survey_count,
  (select count(*) from public.responses       where commune_id = c.id) as response_count,
  (select count(*) from public.commune_modules where commune_id = c.id) as module_count
from public.communes c;

-- ─── 4. Fonction : activité plateforme par heure (super-admin) ───
-- Retourne pour les 30 derniers jours : hour (0-23), response_count
create or replace function public.platform_activity_by_hour()
returns table (hour_of_day integer, response_count bigint)
language sql security definer stable
set search_path = public
as $$
  with bucket as (
    select extract(hour from r.created_at at time zone 'Europe/Paris')::integer as h
      from public.responses r
     where r.created_at >= now() - interval '30 days'
  )
  select h as hour_of_day, count(*)::bigint as response_count
    from bucket
   group by h
   order by h
$$;

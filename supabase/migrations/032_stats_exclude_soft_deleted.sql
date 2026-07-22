-- ═══════════════════════════════════════════════════════════════
-- Migration 032 — Les statistiques ignorent les éléments supprimés
--
-- Les sondages et les réponses sont en soft-delete depuis la
-- migration 009 (`deleted_at`), mais les agrégats SQL comptaient
-- toujours les lignes mises à la corbeille : le compteur
-- « Réponses » des tableaux de bord ne bougeait pas après une
-- suppression.
--
-- Idempotente (create or replace uniquement).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Vue commune_stats (super-admin : liste des communes) ───
create or replace view public.commune_stats as
select
  c.id, c.name, c.slug, c.code_postal, c.created_at, c.archived_at,
  (select count(*) from public.profiles        where commune_id = c.id) as user_count,
  (select count(*) from public.surveys
     where commune_id = c.id and deleted_at is null)                    as survey_count,
  (select count(*) from public.responses
     where commune_id = c.id and deleted_at is null)                    as response_count,
  (select count(*) from public.commune_modules where commune_id = c.id) as module_count
from public.communes c;

-- ─── 2. Activité plateforme par heure (super-admin) ───
-- ⚠ La colonne d'horodatage est `submitted_at`, pas `created_at`
-- (cf. migration 006, qui corrigeait déjà ce point).
create or replace function public.platform_activity_by_hour()
returns table (hour_of_day integer, response_count bigint)
language sql security definer stable
set search_path = public
as $$
  with bucket as (
    select extract(hour from r.submitted_at at time zone 'Europe/Paris')::integer as h
      from public.responses r
     where r.submitted_at >= now() - interval '30 days'
       and r.deleted_at is null
  )
  select h as hour_of_day, count(*)::bigint as response_count
    from bucket
   group by h
   order by h
$$;

grant execute on function public.platform_activity_by_hour() to authenticated;

-- ─── 3. Stats agrégées d'un sondage ───
create or replace function public.get_survey_stats(p_survey_id uuid)
returns json as $$
declare
  result json;
begin
  select json_build_object(
    'total_responses', count(*),
    'first_response', min(submitted_at),
    'last_response', max(submitted_at),
    'avg_duration', round(avg(duration_seconds))
  ) into result
  from public.responses
  where survey_id = p_survey_id
    and deleted_at is null;

  return result;
end;
$$ language plpgsql security definer set search_path = public;

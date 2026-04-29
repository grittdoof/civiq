-- ═══════════════════════════════════════════════════════════════
-- Migration 006 — Correctifs
--   • Bug : platform_activity_by_hour() référençait responses.created_at
--     mais la colonne est submitted_at. Réécriture.
--   • Idempotente.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.platform_activity_by_hour()
returns table (hour_of_day integer, response_count bigint)
language sql security definer stable
set search_path = public
as $$
  with bucket as (
    select extract(hour from r.submitted_at at time zone 'Europe/Paris')::integer as h
      from public.responses r
     where r.submitted_at >= now() - interval '30 days'
  )
  select h as hour_of_day, count(*)::bigint as response_count
    from bucket
   group by h
   order by h
$$;

grant execute on function public.platform_activity_by_hour() to authenticated;

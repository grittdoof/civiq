-- Retour arrière de 048_vues_privees.sql — ⚠ ROUVRE LA FUITE.
alter view public.tickets_reporting_v reset (security_invoker);
alter view public.commune_stats       reset (security_invoker);
alter view public.surveys_trash       reset (security_invoker);
grant all on public.tickets_reporting_v to anon, authenticated;
grant all on public.commune_stats       to anon, authenticated;
grant all on public.surveys_trash       to anon, authenticated;

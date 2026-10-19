-- ═══════════════════════════════════════════════════════════════
-- 048 — Fuite : vues publiques lisibles sans connexion
--
-- Une vue Postgres s'exécute avec les droits de son propriétaire et
-- ignore donc la RLS des tables lues. Les trois vues ci-dessous étaient
-- accordées à `anon` et `authenticated` : avec la seule clé publique,
-- l'API REST renvoyait tous les signalements (tickets_reporting_v),
-- les statistiques des communes (commune_stats) et la corbeille des
-- sondages (surveys_trash), toutes communes confondues.
--
-- L'application ne les lit qu'avec la clé de service : on retire
-- l'accès aux rôles clients et on passe les vues en security_invoker
-- (si un accès client est un jour rouvert, la RLS s'appliquera).
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

alter view public.tickets_reporting_v set (security_invoker = true);
alter view public.commune_stats       set (security_invoker = true);
alter view public.surveys_trash       set (security_invoker = true);

revoke all on public.tickets_reporting_v from anon, authenticated;
revoke all on public.commune_stats       from anon, authenticated;
revoke all on public.surveys_trash       from anon, authenticated;

grant select on public.tickets_reporting_v to service_role;
grant select on public.commune_stats       to service_role;
grant select on public.surveys_trash       to service_role;

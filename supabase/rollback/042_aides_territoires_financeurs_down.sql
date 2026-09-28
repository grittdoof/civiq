-- Retour arrière de 042. Les fiches de financeurs locaux sont exportées
-- d'abord (scripts/export-module-projets.mjs) : ce sont des données saisies.
drop table if exists public.campagne_alertes;
alter table public.financings drop constraint if exists financings_source_check;
alter table public.financings
  drop column if exists financeur_local_id,
  drop column if exists aide_ref,
  drop column if exists source;
drop table if exists public.financeurs_locaux;
drop table if exists public.aides_sync_log;
drop table if exists public.aides_cache;

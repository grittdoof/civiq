-- Retour arrière de 037. projects.type (enum) est resté synchronisé : aucune perte.
drop trigger if exists trg_projects_sync_type_code on public.projects;
drop function if exists public.projects_sync_type_code();
drop index if exists public.idx_projects_type_code;
alter table public.projects drop constraint if exists projects_type_code_fkey;
alter table public.projects drop column if exists type_code;
drop table if exists public.types_projet;

alter table public.commune_settings
  drop constraint if exists commune_settings_seuil_delegation_check,
  drop constraint if exists commune_settings_delegation_complete_check,
  drop constraint if exists commune_settings_nb_devis_check,
  drop constraint if exists commune_settings_seuil_devis_check,
  drop constraint if exists commune_settings_fctva_check,
  drop constraint if exists commune_settings_insee_check;
alter table public.commune_settings
  drop column if exists seuil_delegation_maire_ht,
  drop column if exists delegation_deliberation_num,
  drop column if exists delegation_deliberation_date,
  drop column if exists regles_internes_actives,
  drop column if exists nb_devis_exige,
  drop column if exists seuil_devis_exige_ht,
  drop column if exists taux_fctva,
  drop column if exists code_insee,
  drop column if exists updated_by;
-- Les lignes par défaut insérées par 038 sont inoffensives (taux par défaut).

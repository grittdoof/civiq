-- Retour arrière de 040. Les projets créés par le nouveau parcours restent
-- valides pour l'ancienne interface (type, phase, pilote_elu renseignés).
drop function if exists public.create_project_from_wizard(jsonb);
drop table if exists public.project_contributors;
drop index if exists public.idx_projects_commission_pilote;
alter table public.projects
  drop constraint if exists projects_fourchette_check,
  drop constraint if exists projects_jauge_check,
  drop constraint if exists projects_evenement_fin_check,
  drop constraint if exists projects_blocs_supp_check;
alter table public.projects
  drop column if exists commission_pilote_id,
  drop column if exists fourchette_estimation,
  drop column if exists echeance_souhaitee,
  drop column if exists evenement_debut,
  drop column if exists evenement_fin,
  drop column if exists lieu,
  drop column if exists jauge,
  drop column if exists blocs_supplementaires;

-- Vue de compatibilité (uniquement si l'on revient aussi au code d'avant le lot A)
create or replace view public.stakeholders with (security_invoker = true) as
  select id, commune_id, nom, organisation, email, telephone, categorie as type, created_at
    from public.contacts where deleted_at is null;

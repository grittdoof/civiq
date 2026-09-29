-- Retour arrière de 045_corbeille_projets.sql
-- Les sauvegardes déjà écrites dans le bucket `project-archives` sont
-- conservées (le bucket n'est pas supprimé). La colonne suppression_motif
-- est conservée (aucune perte de donnée).
drop function if exists public.purge_project(uuid);
drop function if exists public.project_snapshot(uuid);

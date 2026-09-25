-- Retour arrière de 038. `fait` et `echeance` sont restés synchronisés : aucune perte
-- pour l'interface actuelle. Les étapes créées sans phase reçoivent la 1re phase du gabarit.
drop trigger if exists trg_milestones_avancement on public.milestones;
drop function if exists public.milestones_recompute_avancement();
drop function if exists public.project_recompute_avancement(uuid);
alter table public.projects drop constraint if exists projects_avancement_manuel_check;
alter table public.projects
  drop column if exists avancement_pct,
  drop column if exists avancement_manuel_pct,
  drop column if exists avancement_manuel_motif,
  drop column if exists avancement_manuel_par,
  drop column if exists avancement_manuel_le;

drop index if exists public.idx_project_documents_milestone;
alter table public.project_documents drop column if exists milestone_id, drop column if exists note_interne;

drop trigger if exists trg_milestones_sync_legacy on public.milestones;
drop function if exists public.milestones_sync_legacy();
drop index if exists public.idx_milestones_prev;

update public.milestones m
   set phase = (public.project_phase_order(p.type))[1]
  from public.projects p
 where p.id = m.project_id and m.phase is null;
alter table public.milestones alter column phase set not null;

alter table public.milestones drop constraint if exists milestones_statut_check;
alter table public.milestones
  drop column if exists statut,
  drop column if exists date_previsionnelle,
  drop column if exists date_reelle,
  drop column if exists est_un_jalon,
  drop column if exists remonter_au_reporting,
  drop column if exists commentaire,
  drop column if exists commentaire_note_interne,
  drop column if exists ordre,
  drop column if exists created_by;

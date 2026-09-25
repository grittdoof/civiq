-- ═══════════════════════════════════════════════════════════════
-- 036 — Projets lot A : suppression logique + fin des cascades
--
-- Les pièces d'un projet (devis, délibérations, comptes rendus,
-- émargements) sont des archives publiques (Code du patrimoine) : plus
-- aucune suppression physique en cascade.
--   1. deleted_at (suppression logique) sur les tables métier ;
--      archived_at / archived_by / archive_motif sur projects.
--   2. Toutes les FK ON DELETE CASCADE vers projects, commissions,
--      commission_sessions, commission_members et stakeholders passent
--      en ON DELETE RESTRICT : un DELETE physique oublié échoue au lieu
--      d'effacer silencieusement l'historique.
--
-- Idempotente. Retour arrière : supabase/rollback/036_soft_delete_et_fk_restrict_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colonnes de suppression logique ───
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'milestones', 'project_documents', 'financings', 'project_quotes',
    'project_budget_lines', 'project_deliberations', 'project_authorizations',
    'project_communications', 'commissions', 'commission_members',
    'commission_sessions', 'session_documents'
  ] loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_by uuid references public.profiles(id) on delete set null', t);
  end loop;
end $$;

alter table public.projects add column if not exists archived_at   timestamptz;
alter table public.projects add column if not exists archived_by   uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists archive_motif text;

comment on column public.projects.deleted_at  is 'Suppression logique (corbeille). Jamais de DELETE physique : archives publiques.';
comment on column public.projects.archived_at is 'Projet archivé : consultable, exclu des listes actives, du calendrier et des statistiques.';

-- Index partiels sur les lignes vivantes (toutes les lectures filtrent deleted_at is null)
create index if not exists idx_projects_commune_alive
  on public.projects (commune_id, date_maj desc) where deleted_at is null;
create index if not exists idx_milestones_project_alive
  on public.milestones (project_id) where deleted_at is null;
create index if not exists idx_project_documents_project_alive
  on public.project_documents (project_id) where deleted_at is null;
create index if not exists idx_financings_project_alive
  on public.financings (project_id) where deleted_at is null;
create index if not exists idx_commission_sessions_alive
  on public.commission_sessions (commission_id, date_seance desc) where deleted_at is null;

-- ─── 2. Cascades → RESTRICT ───
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
     where c.contype = 'f'
       and c.confdeltype = 'c'
       and c.connamespace = 'public'::regnamespace
       and c.confrelid in (
         'public.projects'::regclass, 'public.commissions'::regclass,
         'public.commission_sessions'::regclass, 'public.commission_members'::regclass,
         'public.stakeholders'::regclass
       )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname,
                   replace(r.def, 'ON DELETE CASCADE', 'ON DELETE RESTRICT'));
  end loop;
end $$;

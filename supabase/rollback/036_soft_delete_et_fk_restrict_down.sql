-- Retour arrière de 036 — rétablit les cascades et retire les colonnes.
-- ⚠ Les lignes marquées deleted_at / archived_at redeviendraient visibles :
--   exporter d'abord `select * from … where deleted_at is not null`.

-- FK : liste exacte des contraintes passées en RESTRICT par 036 (relevée le 25/09/2026)
do $$
declare
  n text;
  r record;
begin
  foreach n in array array[
    'session_attendance_commission_member_id_fkey', 'session_convocations_commission_member_id_fkey',
    'session_attendance_session_id_fkey', 'session_convocations_session_id_fkey',
    'session_decisions_session_id_fkey', 'session_documents_session_id_fkey',
    'session_minutes_sends_session_id_fkey', 'commission_members_commission_id_fkey',
    'commission_projects_commission_id_fkey', 'commission_sessions_commission_id_fkey',
    'commissions_parent_id_fkey', 'commission_projects_project_id_fkey',
    'financings_project_id_fkey', 'milestones_project_id_fkey',
    'project_authorizations_project_id_fkey', 'project_budget_lines_project_id_fkey',
    'project_communications_project_id_fkey', 'project_deliberations_project_id_fkey',
    'project_documents_project_id_fkey', 'project_lifecycle_costs_project_id_fkey',
    'project_phase_log_project_id_fkey', 'project_quotes_project_id_fkey',
    'project_stakeholders_project_id_fkey', 'project_subscribers_project_id_fkey',
    'project_stakeholders_stakeholder_id_fkey'
  ] loop
    for r in
      select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
        from pg_constraint c where c.conname = n and c.connamespace = 'public'::regnamespace
    loop
      execute format('alter table %s drop constraint %I', r.tbl, r.conname);
      execute format('alter table %s add constraint %I %s', r.tbl, r.conname,
                     replace(r.def, 'ON DELETE RESTRICT', 'ON DELETE CASCADE'));
    end loop;
  end loop;
end $$;

drop index if exists public.idx_projects_commune_alive;
drop index if exists public.idx_milestones_project_alive;
drop index if exists public.idx_project_documents_project_alive;
drop index if exists public.idx_financings_project_alive;
drop index if exists public.idx_commission_sessions_alive;

alter table public.projects drop column if exists archived_at;
alter table public.projects drop column if exists archived_by;
alter table public.projects drop column if exists archive_motif;

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
    execute format('alter table public.%I drop column if exists deleted_by', t);
    execute format('alter table public.%I drop column if exists deleted_at', t);
  end loop;
end $$;

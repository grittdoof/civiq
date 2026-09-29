-- ═══════════════════════════════════════════════════════════════
-- 045 — Corbeille des projets : suppression en deux temps
--
-- 1. Mise à la corbeille par la commune (projects.deleted_at, déjà en
--    place depuis 036) : le projet disparaît partout, sauvegarde JSON prise.
-- 2. 30 jours de corbeille : le super-administrateur peut restaurer, ou
--    supprimer définitivement à tout moment. Passé 30 jours, suppression
--    définitive automatique (tâche planifiée quotidienne).
--
-- Avant toute suppression définitive, une sauvegarde complète est écrite
-- dans le bucket privé `project-archives` (JSON de toutes les lignes +
-- copie des pièces jointes). Les tickets et décisions de séance liés sont
-- conservés : leur lien vers le projet est remis à vide (ON DELETE SET NULL).
--
-- Fonctions réservées au service role. Idempotente.
-- Retour arrière : supabase/rollback/045_corbeille_projets_down.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.projects add column if not exists suppression_motif text;

-- ─── Sauvegarde : toutes les lignes du projet, en un document JSON ───
create or replace function public.project_snapshot(p_project_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'format', 'gociviq.projet.v1',
    'exported_at', now(),
    'project', (select to_jsonb(p) from public.projects p where p.id = p_project_id),
    'commune', (select jsonb_build_object('id', c.id, 'name', c.name) from public.communes c join public.projects p on p.commune_id = c.id where p.id = p_project_id),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.milestones x where x.project_id = p_project_id),
    'milestone_contacts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.milestone_contacts x join public.milestones m on m.id = x.milestone_id where m.project_id = p_project_id),
    'financings', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.financings x where x.project_id = p_project_id),
    'budget_lines', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.project_budget_lines x where x.project_id = p_project_id),
    'quotes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_quotes x where x.project_id = p_project_id),
    'documents', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_documents x where x.project_id = p_project_id),
    'deliberations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_deliberations x where x.project_id = p_project_id),
    'authorizations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_authorizations x where x.project_id = p_project_id),
    'communications', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_communications x where x.project_id = p_project_id),
    'lifecycle_costs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_lifecycle_costs x where x.project_id = p_project_id),
    'stakeholders', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_stakeholders x where x.project_id = p_project_id),
    'contributors', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_contributors x where x.project_id = p_project_id),
    'subscribers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_subscribers x where x.project_id = p_project_id),
    'phase_log', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.project_phase_log x where x.project_id = p_project_id),
    'commission_projects', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.commission_projects x where x.project_id = p_project_id),
    'tickets_lies', (select coalesce(jsonb_agg(t.id), '[]') from public.tickets t where t.project_id = p_project_id),
    'decisions_liees', (select coalesce(jsonb_agg(d.id), '[]') from public.session_decisions d where d.project_id = p_project_id)
  )
$$;

-- ─── Suppression définitive (uniquement un projet déjà à la corbeille) ───
create or replace function public.purge_project(p_project_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.projects where id = p_project_id and deleted_at is not null) then
    raise exception 'PROJET_PAS_A_LA_CORBEILLE';
  end if;
  delete from public.milestone_contacts where milestone_id in (select id from public.milestones where project_id = p_project_id);
  delete from public.project_quotes where project_id = p_project_id;
  delete from public.project_deliberations where project_id = p_project_id;
  delete from public.project_authorizations where project_id = p_project_id;
  delete from public.project_documents where project_id = p_project_id;
  delete from public.milestones where project_id = p_project_id;
  delete from public.financings where project_id = p_project_id;
  delete from public.project_budget_lines where project_id = p_project_id;
  delete from public.project_communications where project_id = p_project_id;
  delete from public.project_lifecycle_costs where project_id = p_project_id;
  delete from public.project_stakeholders where project_id = p_project_id;
  delete from public.project_contributors where project_id = p_project_id;
  delete from public.project_subscribers where project_id = p_project_id;
  delete from public.project_phase_log where project_id = p_project_id;
  delete from public.commission_projects where project_id = p_project_id;
  -- tickets.project_id et session_decisions.project_id : ON DELETE SET NULL.
  delete from public.projects where id = p_project_id;
end
$$;

revoke execute on function public.project_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.purge_project(uuid) from public, anon, authenticated;
grant execute on function public.project_snapshot(uuid) to service_role;
grant execute on function public.purge_project(uuid) to service_role;

-- ─── Archives (privé, service role uniquement : aucune policy) ───
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-archives', 'project-archives', false, 52428800)
on conflict (id) do nothing;

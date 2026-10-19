-- ═══════════════════════════════════════════════════════════════
-- 050 — Projets : clôture, préférences d'affichage, envoi d'étapes
--
-- • projects.clos_at / clos_par / clos_bilan : un dossier clôturé sort
--   des projets ouverts, reste consultable et peut être rouvert.
-- • profiles.preferences : préférences d'affichage par utilisateur
--   (filtres de la liste des projets), écrites par le serveur.
-- • milestone_envois : historique des étapes envoyées par email à un
--   tiers (destinataires, objet, pièces jointes). Service role seul.
-- • project_snapshot() / purge_project() : prennent en compte la
--   nouvelle table (règle de la corbeille, Session 18).
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table public.projects
  add column if not exists clos_at    timestamptz,
  add column if not exists clos_par   uuid,
  add column if not exists clos_bilan text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_clos_par_fkey') then
    alter table public.projects
      add constraint projects_clos_par_fkey foreign key (clos_par) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists idx_projects_commune_clos on public.projects(commune_id, clos_at);

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create table if not exists public.milestone_envois (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete restrict,
  milestone_id   uuid not null references public.milestones(id) on delete restrict,
  envoye_par     uuid references public.profiles(id) on delete set null,
  destinataires  text[] not null,
  copie          text[] not null default '{}',
  objet          text not null,
  pieces_jointes jsonb not null default '[]'::jsonb,
  envoye         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_milestone_envois_milestone on public.milestone_envois(milestone_id, created_at desc);
alter table public.milestone_envois enable row level security;
revoke all on public.milestone_envois from anon, authenticated;
grant all on public.milestone_envois to service_role;

create or replace function public.project_snapshot(p_project_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'format', 'gociviq.projet.v1',
    'exported_at', now(),
    'project', (select to_jsonb(p) from public.projects p where p.id = p_project_id),
    'commune', (select jsonb_build_object('id', c.id, 'name', c.name) from public.communes c join public.projects p on p.commune_id = c.id where p.id = p_project_id),
    'milestones', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.milestones x where x.project_id = p_project_id),
    'milestone_contacts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.milestone_contacts x join public.milestones m on m.id = x.milestone_id where m.project_id = p_project_id),
    'milestone_envois', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]') from public.milestone_envois x where x.project_id = p_project_id),
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
$function$;

create or replace function public.purge_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.projects where id = p_project_id and deleted_at is not null) then
    raise exception 'PROJET_PAS_A_LA_CORBEILLE';
  end if;
  delete from public.milestone_envois where project_id = p_project_id;
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
  delete from public.projects where id = p_project_id;
end
$function$;

revoke execute on function public.project_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.purge_project(uuid) from public, anon, authenticated;
grant execute on function public.project_snapshot(uuid) to service_role;
grant execute on function public.purge_project(uuid) to service_role;

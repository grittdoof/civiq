-- ═══════════════════════════════════════════════════════════════
-- 044 — Projets lot F : projets confidentiels (brief §2.10)
--
-- Un projet confidentiel (négociation foncière, précontentieux…) n'est
-- visible que :
--   • du bureau municipal (rôles admin et super_admin — décision Q3) ;
--   • des personnes qui le portent : élu référent, agent, contributeurs.
--
-- La règle est portée par public.user_voit_projet(), utilisée par les
-- policies de `projects` ; les tables filles (étapes, budget, devis,
-- subventions, documents…) passent par une sous-requête sur `projects`
-- ou par user_can_edit_project() : elles héritent de la restriction.
-- Le code serveur (service role) applique la même règle
-- (lib/projects/confidentialite.ts).
--
-- Additive, compatible avec le code en ligne (colonne à false par défaut).
-- Idempotente. Retour arrière : supabase/rollback/044_projets_confidentiel_down.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.projects add column if not exists confidentiel boolean not null default false;
alter table public.projects add column if not exists confidentiel_motif text;
alter table public.projects add column if not exists confidentiel_par uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists confidentiel_le timestamptz;
comment on column public.projects.confidentiel is
  'Projet visible du seul bureau municipal (admin, super_admin) et des personnes qui le portent (élu référent, agent, contributeurs).';

create or replace function public.user_voit_projet(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        not p.confidentiel
        or public.my_role() in ('admin', 'super_admin')
        or auth.uid() in (p.pilote_elu, p.pilote_agent)
        or exists (select 1 from public.project_contributors c where c.project_id = p.id and c.profile_id = auth.uid())
      )
  )
$$;
revoke execute on function public.user_voit_projet(uuid) from public, anon;
grant execute on function public.user_voit_projet(uuid) to authenticated, service_role;

-- Écriture sur les tables filles : même règle de visibilité.
create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and public.user_can_access_commune(p.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  ) and public.user_voit_projet(p_project_id)
$$;
grant execute on function public.user_can_edit_project(uuid) to authenticated;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin')
         and (not confidentiel or public.user_voit_projet(id)));

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin')
         and (not confidentiel or public.user_voit_projet(id)));

-- Retour arrière de 044_projets_confidentiel.sql
-- ⚠ Rend de nouveau visibles de tous les éditeurs les projets marqués
-- confidentiels. Les colonnes sont conservées (aucune perte de donnée) ;
-- seules les règles d'accès reviennent à leur état de la migration 017.

create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and public.user_can_access_commune(p.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  )
$$;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop function if exists public.user_voit_projet(uuid);
-- Pour supprimer aussi les colonnes (après export) :
-- alter table public.projects drop column confidentiel, drop column confidentiel_motif,
--   drop column confidentiel_par, drop column confidentiel_le;

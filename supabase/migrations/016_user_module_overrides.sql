-- ═══════════════════════════════════════════════════════════════
-- 016 — Per-user module overrides
--
-- Permet au super-admin de désactiver explicitement un module pour
-- un utilisateur précis, même si ce module est actif au niveau commune.
--
-- Règle d'accès finale :
--   • super_admin → tous modules
--   • viewer     → aucun module
--   • admin/editor → modules de la commune SAUF ceux explicitement
--                    désactivés dans profile_module_overrides
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profile_module_overrides (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, module_id)
);

create index if not exists idx_pmo_profile on public.profile_module_overrides(profile_id);

alter table public.profile_module_overrides enable row level security;

-- Lecture : super-admin uniquement (les users normaux n'ont pas besoin
-- de voir leurs propres overrides — l'app les utilise au niveau serveur)
drop policy if exists "pmo super admin read" on public.profile_module_overrides;
create policy "pmo super admin read"
  on public.profile_module_overrides for select
  using (public.my_role() = 'super_admin');

-- Écriture : super-admin uniquement
drop policy if exists "pmo super admin write" on public.profile_module_overrides;
create policy "pmo super admin write"
  on public.profile_module_overrides for all
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

-- Fonction utilitaire SECURITY DEFINER : retourne les modules effectifs
-- pour un profil donné (bypass RLS, optimisé pour les guards).
create or replace function public.modules_for_profile(p_profile_id uuid)
returns setof text
language sql
security definer
stable
as $$
  with prof as (
    select role, commune_id from public.profiles where id = p_profile_id
  ),
  base as (
    -- Modules de la commune (vide pour viewer ou sans commune)
    select cm.module_id
    from public.commune_modules cm, prof
    where prof.commune_id is not null
      and prof.role in ('admin', 'editor')
      and cm.commune_id = prof.commune_id
  ),
  overrides as (
    select module_id, enabled
    from public.profile_module_overrides
    where profile_id = p_profile_id
  )
  -- Modules effectifs = base \ (overrides où enabled=false)
  select b.module_id
  from base b
  where not exists (
    select 1 from overrides o
    where o.module_id = b.module_id and o.enabled = false
  )
  union
  -- + modules super_admin (tous)
  select m.id
  from public.modules m, prof
  where prof.role = 'super_admin' and m.is_available = true;
$$;

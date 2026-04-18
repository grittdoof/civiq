-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Correction profonde des policies RLS
--
-- PROBLÈME :
-- Toutes les policies du type :
--   commune_id in (select commune_id from profiles where id = auth.uid())
-- sont RÉCURSIVES : elles déclenchent la policy SELECT sur profiles,
-- qui elle-même tente de lire profiles → boucle → NULL → tout bloqué.
--
-- SOLUTION :
-- 1. Créer une fonction SECURITY DEFINER qui lit profiles SANS RLS
-- 2. Remplacer tous les subqueries récursifs par un appel à cette fn
-- 3. Ajouter la policy directe "Users can view own profile"
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Fonction sécurisée pour obtenir sa commune_id ───────────
-- SECURITY DEFINER = s'exécute avec les droits du propriétaire (postgres)
-- donc bypass RLS sur profiles → pas de récursion
create or replace function public.my_commune_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select commune_id from public.profiles where id = auth.uid()
$$;

-- ─── 2. Fonction sécurisée pour obtenir son rôle ────────────────
create or replace function public.my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ─── 3. Policy directe sur profiles (non-récursive) ─────────────
-- Permet à chaque user de voir son propre profil sans passer par la subquery
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

-- ─── 4. Remplacer la policy récursive profiles ───────────────────
drop policy if exists "Profiles are viewable by same commune" on public.profiles;
create policy "Profiles are viewable by same commune"
  on public.profiles for select
  using (commune_id = public.my_commune_id());

-- ─── 5. Policy UPDATE profiles ───────────────────────────────────
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── 6. Surveys : remplacer les subqueries récursifs ─────────────
drop policy if exists "All surveys viewable by commune members" on public.surveys;
create policy "All surveys viewable by commune members"
  on public.surveys for select
  using (commune_id = public.my_commune_id());

drop policy if exists "Surveys are editable by commune editors" on public.surveys;
create policy "Surveys are editable by commune editors"
  on public.surveys for all
  using (
    commune_id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin', 'editor')
  );

-- Policy INSERT explicite (couverte par "for all" mais on l'explicite)
create policy "Commune editors can insert surveys"
  on public.surveys for insert
  with check (
    commune_id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin', 'editor')
  );

-- ─── 7. Responses : même fix ─────────────────────────────────────
drop policy if exists "Responses are viewable by commune members" on public.responses;
create policy "Responses are viewable by commune members"
  on public.responses for select
  using (commune_id = public.my_commune_id());

-- ─── 8. Communes : même fix ──────────────────────────────────────
drop policy if exists "Communes are editable by their admins" on public.communes;
create policy "Communes are editable by their admins"
  on public.communes for update
  using (
    id = public.my_commune_id()
    and public.my_role() in ('admin', 'super_admin')
  );

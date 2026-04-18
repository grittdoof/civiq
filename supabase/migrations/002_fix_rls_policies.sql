-- ═══════════════════════════════════════════════════════════════
-- CIVIQ — Correction des policies RLS
-- Problème : la policy "Profiles viewable by same commune" est
-- récursive (elle se requête elle-même) → résultat NULL → profil
-- illisible → dashboard bloqué sur "Chargement…"
-- Solution : ajouter une policy directe "see own profile"
-- + policy INSERT manquante sur surveys pour les editors
-- ═══════════════════════════════════════════════════════════════

-- 1. Permettre à chaque utilisateur de voir son propre profil
--    (sans passer par la query récursive qui cause le bug)
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

-- 2. Permettre à chaque utilisateur de voir son propre profil
--    même quand commune_id est NULL (ex: juste après inscription,
--    avant d'avoir complété /admin/setup)
--    → la policy existante échoue si commune_id est null

-- 3. Policy INSERT manquante sur surveys
--    La policy "Surveys are editable by commune editors" couvre
--    UPDATE et DELETE via "for all" mais pas INSERT explicitement.
--    Supabase interprète "for all" comme SELECT+INSERT+UPDATE+DELETE
--    → normalement ok, mais on ajoute une policy explicite au cas où.
create policy "Commune editors can insert surveys"
  on public.surveys for insert
  with check (
    commune_id in (
      select commune_id from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'super_admin', 'editor')
    )
  );

-- 4. Policy UPDATE explicite sur profiles (pour saveProfile)
--    La policy existante "Users can update own profile" devrait suffire,
--    mais on vérifie qu'elle couvre bien le WITH CHECK aussi.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 5. S'assurer que les admins peuvent bien mettre à jour leur commune
--    Problème potentiel : si le rôle du profil n'est pas 'admin',
--    la policy échoue silencieusement.
--    On ajoute un log pour debug + on confirme la policy existante.
--    (pas de changement, juste documentation)

-- Vérification : après cette migration, tester avec :
-- select id, role, commune_id from profiles where id = auth.uid();

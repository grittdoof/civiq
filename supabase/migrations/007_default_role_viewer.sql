-- ═══════════════════════════════════════════════════════════════
-- Migration 007 — Rôle par défaut « viewer » (administré)
--
-- Tout nouveau compte créé sans rôle explicite devient « viewer ».
-- Seul le super-admin peut promouvoir au rôle admin / editor.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles
  alter column role set default 'viewer';

-- Index utile pour les requêtes RLS / dashboard
create index if not exists idx_profiles_role on public.profiles(role);

-- Politique : un user peut s'auto-créer un profil minimal (utilisé
-- par le callback /auth/callback en fallback si l'API service échoue).
-- Le rôle est forcé à 'viewer' au niveau colonne via le default ;
-- on ajoute aussi une vérification soft pour éviter qu'un user ne
-- s'auto-promeuve via une mutation directe.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    id = auth.uid()
    and (role is null or role = 'viewer')
  );

-- Empêcher un user de modifier son propre rôle (sauf super-admin)
drop policy if exists "Users can update own profile non-role" on public.profiles;
create policy "Users can update own profile non-role"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

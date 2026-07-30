-- ═══════════════════════════════════════════════════════════════
-- Migration 033 — Coordonnées de la mairie : téléphone + demandes
--
-- 1. `communes.phone` : la table communes n'avait PAS de colonne
--    téléphone (le `phone` de la migration 012 est sur `profiles`).
--    On l'ajoute — `website_url` et `contact_email` existent déjà
--    depuis la migration 001.
--
-- 2. `commune_requests.proposed_phone` / `proposed_website` : permet
--    de saisir ces coordonnées dès la demande de création (formulaire
--    d'inscription / onboarding). Elles sont reportées sur la commune
--    à l'approbation par le super-admin, qui peut ensuite les modifier
--    depuis /super-admin/communes/[id].
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table public.communes
  add column if not exists phone text;

alter table public.commune_requests
  add column if not exists proposed_phone   text,
  add column if not exists proposed_website text;

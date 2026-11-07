-- ═══════════════════════════════════════════════════════════════
-- 060 — Signalements : page publique d'information (lot 4 bis)
--
-- Tableau de bord pour les habitants, `/interventions/<commune>`,
-- désactivé par défaut. Chiffres agrégés uniquement (aucun titre,
-- adresse, nom ni description) ; seuls les tickets « standard » des
-- thèmes publiés sont comptés.
--   tickets_public_actif       : page en ligne ou non
--   tickets_public_categories  : catégories (racines) publiées ;
--                                NULL = choix par défaut (tous les thèmes
--                                sauf périscolaire, sécurité, administratif,
--                                informatique et « Autre »)
--
-- Additive et idempotente. Retour arrière :
-- supabase/rollback/060_tickets_page_publique_down.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.commune_settings
  add column if not exists tickets_public_actif boolean not null default false,
  add column if not exists tickets_public_categories uuid[];

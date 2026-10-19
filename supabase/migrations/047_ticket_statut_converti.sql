-- ═══════════════════════════════════════════════════════════════
-- 047 — Lot G : statut de signalement « converti en projet »
--
-- Migration séparée de 048 : Postgres interdit d'utiliser une valeur
-- d'enum dans la transaction qui l'ajoute.
-- Idempotente (if not exists).
-- ═══════════════════════════════════════════════════════════════

alter type public.ticket_statut add value if not exists 'converti_en_projet' after 'annule';

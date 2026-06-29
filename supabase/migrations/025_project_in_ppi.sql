-- ═══════════════════════════════════════════════════════════════
-- Migration 025 — Inclusion d'un projet dans le PPI
-- ═══════════════════════════════════════════════════════════════
--
-- Ajoute un drapeau in_ppi (true par défaut) sur projects qui
-- permet à l'utilisateur d'exclure manuellement une opération du
-- Plan Pluriannuel d'Investissement. Utile pour :
--   - les opérations marginales (frais courants, équipement < seuil)
--   - les projets bloqués ou en pause prolongée
--   - les opérations « accompagnement sans financement » (déjà
--     exclues, mais le flag permet de réintégrer si besoin)
--
-- Idempotente : peut être rejouée sans casser l'état existant.
-- ═══════════════════════════════════════════════════════════════

alter table public.projects
  add column if not exists in_ppi boolean not null default true;

comment on column public.projects.in_ppi is
  'Le projet est inclus dans le Plan Pluriannuel d''Investissement. '
  'False = exclu manuellement par l''utilisateur.';

create index if not exists idx_projects_in_ppi
  on public.projects(commune_id, in_ppi)
  where in_ppi = true;

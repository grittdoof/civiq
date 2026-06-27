-- ═══════════════════════════════════════════════════════════════
-- Migration 026 — Progression des livrables par phase
-- ═══════════════════════════════════════════════════════════════
--
-- Ajoute un champ JSONB phase_progress sur projects qui stocke,
-- pour chaque phase et chaque livrable-type du guide, son état
-- (fait / pas fait) et une note libre optionnelle.
--
-- Format :
--   {
--     "emergence": {
--       "0": { "done": true,  "note": "Fiche signée le 15/03" },
--       "1": { "done": true,  "note": null },
--       "2": { "done": false, "note": null }
--     },
--     "faisabilite": { ... }
--   }
--
-- La clé numérique = index du livrable dans PROJECT_PHASE_GUIDE
-- (côté TypeScript). On évite ainsi une table relationnelle lourde
-- pour ce qui reste fondamentalement de la check-list.
--
-- Idempotente : peut être rejouée sans casser l'état existant.
-- ═══════════════════════════════════════════════════════════════

alter table public.projects
  add column if not exists phase_progress jsonb not null default '{}'::jsonb;

comment on column public.projects.phase_progress is
  'Progression des livrables-type par phase. Format : '
  '{ phase: { livrableIndex: { done: bool, note: text|null } } }';

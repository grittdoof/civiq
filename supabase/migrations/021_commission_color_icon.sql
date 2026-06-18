-- ═══════════════════════════════════════════════════════════════
-- Migration 021 — Couleur + icône par commission
--
-- Permet de différencier visuellement les commissions dans le
-- calendrier et autres vues. La couleur est stockée en HEX
-- (#RRGGBB) ; l'icône est un identifiant Lucide
-- (cf. src/components/projects/CommissionIcon.tsx).
-- ═══════════════════════════════════════════════════════════════

alter table public.commissions
  add column if not exists color text not null default '#5A8DEE'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists icon text not null default 'Gavel';

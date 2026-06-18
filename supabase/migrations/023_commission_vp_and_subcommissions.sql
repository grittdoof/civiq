-- ═══════════════════════════════════════════════════════════════
-- Migration 023 — Vice-président + sous-commissions
--
-- 1. Ajout d'une valeur 'vice_president' à l'enum
--    commission_member_role (en plus de 'president' et 'membre').
-- 2. Ajout d'un parent_id sur commissions pour structurer en
--    sous-commissions (ex: « Urbanisme » a une sous-commission
--    « Voirie » qui suit des projets voirie spécifiques).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Enum commission_member_role : ajouter 'vice_president' ──
do $$ begin
  alter type public.commission_member_role add value if not exists 'vice_president';
exception when others then null; end $$;

-- ─── 2. parent_id sur commissions ──────────────────────────────
alter table public.commissions
  add column if not exists parent_id uuid references public.commissions(id) on delete cascade;

create index if not exists idx_commissions_parent on public.commissions(parent_id);

-- Empêche les cycles 1-niveau (une commission ne peut pas être sa propre parente)
do $$ begin
  alter table public.commissions
    add constraint commissions_no_self_parent
    check (parent_id is null or parent_id <> id);
exception when duplicate_object then null; end $$;

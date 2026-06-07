-- ═══════════════════════════════════════════════════════════════
-- Migration 018 — Membres externes (sans compte) dans les commissions
--
-- Permet d'ajouter des conseillers/invités à une commission ET de
-- les faire émarger même s'ils n'ont pas de compte GoCiviq.
--
-- • commission_members.user_id devient nullable
-- • Ajout des colonnes external_name / external_email / external_phone
-- • Contrainte : soit user_id non null, soit external_name non null
-- • session_attendance.conseiller_user_id devient nullable + ajout de
--   commission_member_id pour rattacher l'émargement à la ligne
--   member (utile pour les externes qui n'ont pas de user_id)
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. commission_members ──────────────────────────────────────
alter table public.commission_members
  alter column user_id drop not null;

alter table public.commission_members
  add column if not exists external_name text,
  add column if not exists external_email text,
  add column if not exists external_phone text;

-- Soit user_id, soit external_name (XOR-ish : au moins un des deux)
do $$ begin
  alter table public.commission_members
    add constraint commission_members_identity_check
    check (user_id is not null or coalesce(trim(external_name), '') <> '');
exception when duplicate_object then null; end $$;

-- Index pour les recherches par nom externe
create index if not exists idx_commission_members_external_name
  on public.commission_members(commission_id, external_name)
  where external_name is not null;

-- ─── 2. session_attendance ──────────────────────────────────────
alter table public.session_attendance
  alter column conseiller_user_id drop not null;

alter table public.session_attendance
  add column if not exists commission_member_id uuid references public.commission_members(id) on delete cascade;

create index if not exists idx_attendance_member
  on public.session_attendance(commission_member_id);

-- Unique (session, member) pour les externes
create unique index if not exists uq_attendance_session_member
  on public.session_attendance(session_id, commission_member_id)
  where commission_member_id is not null;

-- Au moins l'un des deux identifiants
do $$ begin
  alter table public.session_attendance
    add constraint session_attendance_identity_check
    check (conseiller_user_id is not null or commission_member_id is not null);
exception when duplicate_object then null; end $$;

-- ─── 3. RLS policy adjustment ───────────────────────────────────
-- La policy existante "attendance_cud" permet à conseiller_user_id =
-- auth.uid() OU admin. Pour les externes, seuls les admins peuvent
-- marquer la présence (ils émargent de leur main).
drop policy if exists "attendance_cud" on public.session_attendance;
create policy "attendance_cud" on public.session_attendance for all
  using (
    (conseiller_user_id is not null and conseiller_user_id = auth.uid())
    or exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'super_admin')
    )
  )
  with check (
    (conseiller_user_id is not null and conseiller_user_id = auth.uid())
    or exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'super_admin')
    )
  );

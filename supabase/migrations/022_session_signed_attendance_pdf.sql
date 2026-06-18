-- ═══════════════════════════════════════════════════════════════
-- Migration 022 — PDF d'émargement signé (scan papier)
--
-- En complément des signatures électroniques tracées en ligne,
-- on permet d'attacher un scan PDF de la feuille d'émargement
-- signée pendant la séance (cas où les conseillers signent au
-- stylo sur papier puis le secrétaire la scanne).
-- ═══════════════════════════════════════════════════════════════

alter table public.commission_sessions
  add column if not exists signed_attendance_pdf_url text,
  add column if not exists signed_attendance_pdf_path text,
  add column if not exists signed_attendance_uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists signed_attendance_uploaded_at timestamptz;

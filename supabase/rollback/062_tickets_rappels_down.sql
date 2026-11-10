-- Retour arrière de 062 (les rappels deviennent des tickets ordinaires).
drop trigger if exists trg_tickets_zz_rappel on public.tickets;
drop function if exists public.tickets_rappel_delai();
drop index if exists public.idx_tickets_rappels_programmes;
alter table public.tickets
  drop constraint if exists tickets_rappel_avance_chk,
  drop constraint if exists tickets_rappel_repetition_chk,
  drop column if exists rappel_origine_id,
  drop column if exists rappel_envoye_at,
  drop column if exists rappel_repetition,
  drop column if exists rappel_avance_jours,
  drop column if exists rappel_le,
  drop column if exists document_paths;

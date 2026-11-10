-- ═══════════════════════════════════════════════════════════════
-- 062 — Tickets de rappel programmé
--
-- Un rappel est un ticket qui reste « En attente », hors des
-- interventions en cours, jusqu'à sa date. Ce jour-là (moins
-- l'anticipation choisie), une tâche quotidienne l'ouvre et prévient
-- les personnes concernées. Option : répétition annuelle (à la
-- clôture, le rappel de l'année suivante est créé).
--
-- • tickets.rappel_le             : date d'échéance (NULL = pas un rappel)
-- • tickets.rappel_avance_jours   : prévenir N jours avant (0 = le jour même)
-- • tickets.rappel_repetition     : 'aucune' | 'annuelle'
-- • tickets.rappel_envoye_at      : rappel déclenché (NULL = programmé)
-- • tickets.rappel_origine_id     : rappel de l'année précédente
-- • tickets.document_paths        : pièces jointes du ticket (hors rapport
--   de clôture), dans le bucket privé tickets-documents
-- • Délai cible d'un rappel = fin du jour d'échéance (heure de Paris),
--   et non le délai de sa catégorie.
-- • Les rappels n'entrent pas dans les statistiques d'interventions
--   (filtré côté application).
--
-- Additive et idempotente. Retour arrière :
-- supabase/rollback/062_tickets_rappels_down.sql
-- ═══════════════════════════════════════════════════════════════

alter table public.tickets
  add column if not exists rappel_le date,
  add column if not exists rappel_avance_jours integer not null default 0,
  add column if not exists rappel_repetition text not null default 'aucune',
  add column if not exists rappel_envoye_at timestamptz,
  add column if not exists rappel_origine_id uuid references public.tickets(id) on delete set null,
  add column if not exists document_paths text[];

do $$ begin
  alter table public.tickets add constraint tickets_rappel_avance_chk check (rappel_avance_jours between 0 and 365);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.tickets add constraint tickets_rappel_repetition_chk check (rappel_repetition in ('aucune', 'annuelle'));
exception when duplicate_object then null; end $$;

create index if not exists idx_tickets_rappels_programmes
  on public.tickets (rappel_le) where rappel_le is not null and rappel_envoye_at is null;

-- Délai cible d'un rappel : fin du jour d'échéance (passe après
-- trg_tickets_sync_categorie_urgence, qui pose le délai de la catégorie).
create or replace function public.tickets_rappel_delai()
returns trigger language plpgsql as $$
begin
  if new.rappel_le is not null
     and (tg_op = 'INSERT' or new.rappel_le is distinct from old.rappel_le or new.categorie_id is distinct from old.categorie_id) then
    new.delai_cible_le := make_timestamptz(
      extract(year from new.rappel_le)::int, extract(month from new.rappel_le)::int, extract(day from new.rappel_le)::int,
      23, 59, 59, 'Europe/Paris');
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_zz_rappel on public.tickets;
create trigger trg_tickets_zz_rappel
  before insert or update on public.tickets
  for each row execute function public.tickets_rappel_delai();

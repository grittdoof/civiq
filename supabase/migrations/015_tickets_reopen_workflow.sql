-- ═══════════════════════════════════════════════════════════════
-- Migration 015 — Workflow tickets simplifié + réouverture programmée
--
-- 1. Ajoute `reopen_at`, `reopened_at`, `reopen_reason` sur tickets
--    → date de réouverture programmée par l'agent au moment de la
--    clôture si « Nécessite un suivi ultérieur » est coché.
-- 2. Ajoute `document_paths` et `sans_piece_jointe` sur ticket_rapports
--    → étape 1 du wizard : photo OU document OU « pas nécessaire ».
-- 3. Fonction RPC `reopen_due_tickets()` appelée par le cron Vercel
--    toutes les heures via /api/cron/reopen-tickets.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Colonnes réouverture sur tickets ────────────────────────
alter table public.tickets
  add column if not exists reopen_at      timestamptz,
  add column if not exists reopened_at    timestamptz,
  add column if not exists reopen_reason  text;

-- Index partiel : seuls les tickets en attente de réouverture
-- sont scannés par le cron (table peut grossir, on optimise tôt).
create index if not exists idx_tickets_reopen_due
  on public.tickets(reopen_at)
  where reopen_at is not null and reopened_at is null;

-- ─── 2. Colonnes pièces jointes sur ticket_rapports ─────────────
alter table public.ticket_rapports
  add column if not exists document_paths      text[] not null default '{}',
  add column if not exists sans_piece_jointe   boolean not null default false;

comment on column public.ticket_rapports.document_paths is
  'Chemins Storage des documents PDF/Word/Excel attachés au rapport.';
comment on column public.ticket_rapports.sans_piece_jointe is
  'L''agent a déclaré que l''intervention ne nécessite ni photo ni document.';

-- ─── 3. RPC réouverture automatique ─────────────────────────────
-- Appelée par le cron Vercel ; ne fait que les opérations SQL.
-- Le cron-endpoint Next.js gère ensuite l'envoi des notifs push/email
-- en lisant les tickets retournés.
create or replace function public.reopen_due_tickets()
returns setof public.tickets
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.tickets t
  set
    statut       = 'nouveau',
    reopened_at  = now(),
    clos_at      = null,
    clos_by      = null,
    resolu_at    = null,
    updated_at   = now()
  where
    t.reopen_at is not null
    and t.reopen_at <= now()
    and t.reopened_at is null
    and t.clos_at is not null
  returning t.*;
end;
$$;

revoke all on function public.reopen_due_tickets() from public, anon, authenticated;
-- Seule la service_role peut l'appeler (depuis l'endpoint cron)

-- ─── 4. Commentaire système à la réouverture (trigger) ──────────
-- Quand reopened_at passe de null à une date, on insère automatiquement
-- un commentaire système pour tracer l'événement dans le journal.
create or replace function public.tg_ticket_reopen_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.reopened_at is null and new.reopened_at is not null then
    insert into public.ticket_commentaires (ticket_id, auteur_id, contenu, is_systeme)
    values (
      new.id,
      null,
      coalesce(
        '🔄 Ticket rouvert automatiquement : ' || new.reopen_reason,
        '🔄 Ticket rouvert automatiquement (suivi programmé)'
      ),
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tg_ticket_reopen_comment on public.tickets;
create trigger tg_ticket_reopen_comment
  after update on public.tickets
  for each row
  execute function public.tg_ticket_reopen_comment();

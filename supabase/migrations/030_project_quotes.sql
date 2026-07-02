-- ═══════════════════════════════════════════════════════════════
-- Migration 030 — Comparateur de devis prestataires
-- ═══════════════════════════════════════════════════════════════
--
-- Nouvelle table project_quotes qui permet de comparer les devis
-- reçus des prestataires (nom, montant HT/TTC, délai, statut, PJ).
--
-- Rattachement à une phase du projet — typiquement la « mise en
-- œuvre » selon le gabarit :
--   • investment  → realisation
--   • event       → event_logistics
--   • tracking    → tracking_execution
--
-- La PJ (devis PDF) est optionnellement liée à un project_documents
-- déjà uploadé — même bucket, même storage_path, même URL signée.
--
-- Idempotente — rejouable sans danger.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.project_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase not null,
  prestataire text not null,
  objet text,
  montant_ht numeric(14,2),
  montant_ttc numeric(14,2),
  delai_jours int,
  statut text not null default 'recu'
    check (statut in ('recu', 'en_attente', 'retenu', 'non_retenu')),
  document_id uuid references public.project_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_quotes is
  'Devis reçus des prestataires pour comparaison. La pièce jointe (PDF) '
  'est optionnellement liée à project_documents.';
comment on column public.project_quotes.statut is
  'Cycle de vie du devis : recu → en_attente → retenu / non_retenu.';
comment on column public.project_quotes.delai_jours is
  'Délai de réalisation annoncé par le prestataire, en jours calendaires.';

create index if not exists idx_project_quotes_proj
  on public.project_quotes(project_id, phase);
create index if not exists idx_project_quotes_statut
  on public.project_quotes(project_id, statut);

-- Trigger updated_at (fonction déjà définie en migration 017)
drop trigger if exists trg_quotes_updated_at on public.project_quotes;
create trigger trg_quotes_updated_at
  before update on public.project_quotes
  for each row execute function public.tg_set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.project_quotes enable row level security;

drop policy if exists "quotes_select" on public.project_quotes;
create policy "quotes_select" on public.project_quotes for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "quotes_cud" on public.project_quotes;
create policy "quotes_cud" on public.project_quotes for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ═══════════════════════════════════════════════════════════════
-- Fin migration 030
-- ═══════════════════════════════════════════════════════════════

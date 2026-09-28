-- ═══════════════════════════════════════════════════════════════
-- 043 — Projets lot E : calendrier, flux iCal personnel, Google Agenda
--        (brief §2.11)
--
-- 1. calendar_feeds : lien d'abonnement iCal personnel (un actif par
--    utilisateur). Le jeton est aléatoire (192 bits), jamais dérivé d'une
--    donnée personnelle ; « changer de lien » révoque l'ancien.
-- 2. google_calendar_links : connexion Google Agenda d'un utilisateur.
--    Le jeton de rafraîchissement est chiffré (AES-256-GCM, clé en
--    variable d'environnement) : jamais lisible depuis le client.
-- 3. google_calendar_events : empreinte des événements déjà poussés, pour
--    ne renvoyer à Google que ce qui a changé.
--
-- Tables techniques (pas de donnée métier) : suppression en cascade avec
-- le profil. Additive, compatible avec le code en ligne.
-- Idempotente. Retour arrière : supabase/rollback/043_agenda_ical_google_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Flux iCal personnel ───
create table if not exists public.calendar_feeds (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  commune_id       uuid not null references public.communes(id) on delete cascade,
  token            text not null unique,
  perimetre        text not null default 'tout' check (perimetre in ('tout', 'mes')),
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  last_accessed_at timestamptz
);
comment on table public.calendar_feeds is
  'Lien d''abonnement iCal personnel (lot E). Un seul lien actif par utilisateur ; accès par jeton aléatoire, lu par le service role.';
create unique index if not exists uq_calendar_feeds_actif
  on public.calendar_feeds (profile_id) where revoked_at is null;

alter table public.calendar_feeds enable row level security;
drop policy if exists "calendar_feeds_select_own" on public.calendar_feeds;
create policy "calendar_feeds_select_own" on public.calendar_feeds for select
  using (profile_id = auth.uid());
-- Écriture : service role uniquement (API /api/calendar/feed).

-- ─── 2. Connexion Google Agenda ───
create table if not exists public.google_calendar_links (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  commune_id        uuid not null references public.communes(id) on delete cascade,
  google_email      text,
  calendar_id       text,
  refresh_token_enc text,
  perimetre         text not null default 'tout' check (perimetre in ('tout', 'mes')),
  connected_at      timestamptz not null default now(),
  disconnected_at   timestamptz,
  last_sync_at      timestamptz,
  last_sync_ok      boolean,
  last_error        text
);
comment on table public.google_calendar_links is
  'Synchronisation Google Agenda (lot E) : agenda secondaire « GoCiviq » créé par l''application (portée calendar.app.created). Jeton chiffré, service role uniquement.';
alter table public.google_calendar_links enable row level security;
-- Aucune policy : contient un secret chiffré, accès par le service role seulement.

-- ─── 3. Événements poussés vers Google ───
create table if not exists public.google_calendar_events (
  profile_id  uuid not null references public.google_calendar_links(profile_id) on delete cascade,
  source_key  text not null,
  empreinte   text not null,
  synced_at   timestamptz not null default now(),
  primary key (profile_id, source_key)
);
alter table public.google_calendar_events enable row level security;
-- Aucune policy : table technique du service role.

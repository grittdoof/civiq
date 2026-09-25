-- ═══════════════════════════════════════════════════════════════
-- 042 — Projets lot D : subventions et financeurs (brief §2.9)
--
-- 1. aides_cache : copie locale des aides Aides-territoires par commune
--    (rafraîchie par tâche planifiée hebdomadaire — jamais d'appel à
--    l'API pendant le rendu d'une page). Données sous Licence Ouverte
--    v2.0 (Etalab) : l'attribution et la date de mise à jour sont
--    affichées partout où elles sont réutilisées.
-- 2. aides_sync_log : journal des synchronisations (dégradation gracieuse).
-- 3. financeurs_locaux : 10 à 15 fiches par commune pour ce que l'API
--    couvre mal (fonds de concours, amendes de police, Fondation du
--    patrimoine, mécénat local…).
-- 4. financings : origine de la demande (api / local / saisie_libre).
-- 5. campagne_alertes : trace des alertes de campagne envoyées (une par
--    commune et par mois) pour ne jamais notifier deux fois.
--
-- Additive, compatible avec le code en ligne.
-- Idempotente. Retour arrière : supabase/rollback/042_aides_territoires_financeurs_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Cache Aides-territoires ───
create table if not exists public.aides_cache (
  commune_id        uuid not null references public.communes(id) on delete cascade,
  aide_id           text not null,
  nom               text not null,
  slug              text,
  url               text,
  url_candidature   text,
  financeurs        text[] not null default '{}',
  categories        text[] not null default '{}',
  types_aide        text[] not null default '{}',
  description       text,
  date_ouverture    date,
  date_limite       date,
  recurrence        text,
  appel_a_projets   boolean not null default false,
  perimetre         text,
  source_maj        timestamptz,
  fetched_at        timestamptz not null default now(),
  primary key (commune_id, aide_id)
);
comment on table public.aides_cache is
  'Aides issues de l''API Aides-territoires (ANCT / DGALN), Licence Ouverte v2.0. Cache hebdomadaire par commune ; jamais de montant ni de taux estimé.';
create index if not exists idx_aides_cache_deadline on public.aides_cache (commune_id, date_limite);

alter table public.aides_cache enable row level security;
drop policy if exists "aides_cache_select" on public.aides_cache;
create policy "aides_cache_select" on public.aides_cache for select
  using (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'editor', 'super_admin'));
-- Écriture : service role uniquement (tâche planifiée).

-- ─── 2. Journal des synchronisations ───
create table if not exists public.aides_sync_log (
  id          uuid primary key default gen_random_uuid(),
  commune_id  uuid not null references public.communes(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  nb_aides    integer,
  erreur      text
);
create index if not exists idx_aides_sync_log on public.aides_sync_log (commune_id, started_at desc);
alter table public.aides_sync_log enable row level security;
drop policy if exists "aides_sync_log_select" on public.aides_sync_log;
create policy "aides_sync_log_select" on public.aides_sync_log for select
  using (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'editor', 'super_admin'));

-- ─── 3. Financeurs locaux ───
create table if not exists public.financeurs_locaux (
  id                   uuid primary key default gen_random_uuid(),
  commune_id           uuid not null references public.communes(id) on delete restrict,
  nom                  text not null check (btrim(nom) <> ''),
  contact_id           uuid references public.contacts(id) on delete restrict,
  types_projet         text[] not null default '{investissement}',
  periode_depot        text,
  lien                 text,
  notes                text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  deleted_by           uuid references public.profiles(id) on delete set null,
  check (types_projet <@ array['investissement', 'evenementiel', 'suivi_simple']::text[])
);
create index if not exists idx_financeurs_locaux_commune on public.financeurs_locaux (commune_id) where deleted_at is null;
drop trigger if exists trg_financeurs_locaux_updated_at on public.financeurs_locaux;
create trigger trg_financeurs_locaux_updated_at before update on public.financeurs_locaux
  for each row execute function public.tg_set_updated_at();

alter table public.financeurs_locaux enable row level security;
drop policy if exists "financeurs_locaux_select" on public.financeurs_locaux;
create policy "financeurs_locaux_select" on public.financeurs_locaux for select
  using (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'editor', 'super_admin'));
drop policy if exists "financeurs_locaux_cud" on public.financeurs_locaux;
create policy "financeurs_locaux_cud" on public.financeurs_locaux for all
  using (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'super_admin'))
  with check (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'super_admin'));

-- ─── 4. Origine d'une demande de subvention ───
alter table public.financings
  add column if not exists source             text not null default 'saisie_libre',
  add column if not exists aide_ref           text,
  add column if not exists financeur_local_id uuid references public.financeurs_locaux(id) on delete restrict;
do $$ begin
  alter table public.financings add constraint financings_source_check
    check (source in ('api', 'local', 'saisie_libre'));
exception when duplicate_object then null; end $$;

-- ─── 5. Alertes de campagne envoyées ───
create table if not exists public.campagne_alertes (
  id          uuid primary key default gen_random_uuid(),
  commune_id  uuid not null references public.communes(id) on delete cascade,
  periode     text not null,            -- ex. « 2026-10 »
  annee_cible integer not null,         -- année de réalisation des projets visés
  projets     uuid[] not null default '{}',
  destinataires uuid[] not null default '{}',
  sent_at     timestamptz not null default now(),
  unique (commune_id, periode)
);
alter table public.campagne_alertes enable row level security;
drop policy if exists "campagne_alertes_select" on public.campagne_alertes;
create policy "campagne_alertes_select" on public.campagne_alertes for select
  using (public.user_can_access_commune(commune_id) and public.my_role() in ('admin', 'editor', 'super_admin'));

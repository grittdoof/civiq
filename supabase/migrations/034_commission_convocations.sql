-- ═══════════════════════════════════════════════════════════════
-- Migration 034 — Convocations email des séances de commission
--
-- 1. FIX émargement des membres externes (500 en prod) :
--    l'index unique (session_id, commission_member_id) de la 018 est
--    PARTIEL (where commission_member_id is not null). PostgREST génère
--    `ON CONFLICT (session_id, commission_member_id)` sans prédicat →
--    Postgres ne sait pas inférer un index partiel → 42P10
--    « there is no unique or exclusion constraint matching the
--    ON CONFLICT specification ». On le remplace par une contrainte
--    unique pleine (les NULL restent distincts : les lignes internes,
--    sans commission_member_id, ne se gênent pas).
--
-- 2. communes.address : adresse postale de la mairie (pied des emails
--    de convocation).
--
-- 3. session_convocations : une ligne par (séance, membre). Porte le
--    jeton personnel de réponse (lien email, sans compte), le statut
--    de réponse (pending / accepted / declined) et le suivi d'envoi.
--    Couvre les membres internes ET externes (via commission_member_id).
--
-- 4. commission_sessions.convocation_sent_at : dernier envoi.
--
-- 5. Logo de la commune : bucket public `commune-logos` +
--    communes.logo_storage_path (nettoyage de l'ancien fichier).
--    Upload via l'API (service role) : pas de policy d'écriture.
--
-- 6. session_minutes_sends : historique des envois du compte rendu
--    (PDF) par email, destinataire par destinataire.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Émargement : contrainte unique pleine ───────────────────
drop index if exists public.uq_attendance_session_member;

do $$ begin
  alter table public.session_attendance
    add constraint session_attendance_session_member_key
    unique (session_id, commission_member_id);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- ─── 2. Adresse de la mairie ────────────────────────────────────
alter table public.communes
  add column if not exists address text;

-- ─── 3. Convocations ────────────────────────────────────────────
create table if not exists public.session_convocations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.commission_sessions(id) on delete cascade,
  commission_member_id uuid not null references public.commission_members(id) on delete cascade,
  email text,
  -- Jeton opaque (généré côté serveur) : clé du lien de réponse
  token text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  response_comment text,
  sent_at timestamptz,
  send_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, commission_member_id)
);

create index if not exists idx_session_convocations_session
  on public.session_convocations(session_id);

alter table public.session_convocations enable row level security;

-- Lecture : équipe de la commune (admin/editor/super_admin).
-- Écriture : uniquement via le service role (API), y compris la
-- réponse publique par jeton.
drop policy if exists "convocations_select" on public.session_convocations;
create policy "convocations_select" on public.session_convocations for select
  using (
    exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'editor', 'super_admin')
    )
  );

-- ─── 4. Suivi d'envoi sur la séance ─────────────────────────────
alter table public.commission_sessions
  add column if not exists convocation_sent_at timestamptz;

-- ─── 5. Logo de la commune ──────────────────────────────────────
alter table public.communes
  add column if not exists logo_storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commune-logos',
  'commune-logos',
  true,                                          -- affiché dans les emails
  2097152,                                       -- 2 MB max
  array['image/png', 'image/jpeg', 'image/webp'] -- pas de SVG : Gmail ne l'affiche pas
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "commune_logos_read" on storage.objects;
create policy "commune_logos_read" on storage.objects for select
  using (bucket_id = 'commune-logos');

-- ─── 6. Envois du compte rendu par email ────────────────────────
-- Historique : une ligne par destinataire et par envoi (le compte
-- rendu validé peut être envoyé plusieurs fois, à des membres choisis).
create table if not exists public.session_minutes_sends (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.commission_sessions(id) on delete cascade,
  commission_member_id uuid references public.commission_members(id) on delete set null,
  recipient_name text,
  email text not null,
  ok boolean not null,
  error text,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_session_minutes_sends_session
  on public.session_minutes_sends(session_id, sent_at desc);

alter table public.session_minutes_sends enable row level security;

drop policy if exists "minutes_sends_select" on public.session_minutes_sends;
create policy "minutes_sends_select" on public.session_minutes_sends for select
  using (
    exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'editor', 'super_admin')
    )
  );

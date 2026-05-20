-- ═══════════════════════════════════════════════════════════════
-- Migration 010 — Module Tickets d'intervention
--
-- Schéma multi-tenant : chaque ticket appartient à une commune.
-- Adapté du prompt original :
--   • « membres » → public.profiles (table existante)
--   • Ajoute commune_id + RLS isolation par commune
--   • Ajoute le job_title 'agent_technique'
--
-- Idempotente — rejouable sans danger.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Étendre les job_titles autorisés ────────────────────────
-- (la check constraint vit dans la migration 004)
do $$
begin
  alter table public.profiles drop constraint if exists profiles_job_title_check;
  alter table public.profiles add constraint profiles_job_title_check
    check (job_title is null or job_title in (
      'maire', 'adjoint', 'conseiller', 'dgs',
      'secretaire', 'agent', 'agent_technique',
      'associatif', 'citoyen', 'autre'
    ));
end$$;

-- ─── 2. ENUMS du module tickets ─────────────────────────────────
do $$ begin
  create type public.ticket_priorite as enum ('basse', 'normale', 'haute', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_statut as enum (
    'nouveau', 'assigne', 'pris_en_charge', 'en_cours',
    'en_attente', 'resolu', 'clos', 'annule'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_canal as enum (
    'agent_interne', 'elu_terrain', 'email', 'telephone'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_categorie as enum (
    'voirie', 'espaces_verts', 'batiment', 'eclairage_public',
    'proprete', 'mobilier_urbain', 'reseaux_eau', 'signalisation', 'autre'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.photo_type as enum ('signalement', 'service_fait', 'autre');
exception when duplicate_object then null; end $$;

-- ─── 3. Table principale tickets ────────────────────────────────
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  numero serial unique not null,                 -- numéro lisible #N global plateforme

  -- Multi-tenant
  commune_id uuid not null references public.communes(id) on delete cascade,

  -- Création
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  canal public.ticket_canal not null,

  -- Demandeur (si signalement externe retranscrit)
  demandeur_nom text,
  demandeur_telephone text,
  demandeur_email text,
  demandeur_adresse text,

  -- Contenu
  titre text not null,
  description text,
  categorie public.ticket_categorie not null default 'autre',
  priorite public.ticket_priorite not null default 'normale',

  -- Localisation
  adresse text,
  latitude double precision,
  longitude double precision,
  precision_geo text,                            -- 'gps' | 'adresse' | 'manuelle'

  -- Workflow
  statut public.ticket_statut not null default 'nouveau',
  assigne_a uuid references public.profiles(id),
  assigne_at timestamptz,
  pris_en_charge_at timestamptz,
  resolu_at timestamptz,
  clos_at timestamptz,
  clos_by uuid references public.profiles(id),

  echeance date,
  updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_commune     on public.tickets(commune_id);
create index if not exists idx_tickets_statut      on public.tickets(commune_id, statut);
create index if not exists idx_tickets_assigne     on public.tickets(assigne_a);
create index if not exists idx_tickets_priorite    on public.tickets(commune_id, priorite, created_at desc);
create index if not exists idx_tickets_geo         on public.tickets(latitude, longitude);
create index if not exists idx_tickets_categorie   on public.tickets(commune_id, categorie);

-- ─── 4. Photos ──────────────────────────────────────────────────
create table if not exists public.ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null,
  type public.photo_type not null default 'signalement',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  legende text
);
create index if not exists idx_ticket_photos_ticket on public.ticket_photos(ticket_id);

-- ─── 5. Commentaires ────────────────────────────────────────────
create table if not exists public.ticket_commentaires (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  auteur_id uuid references public.profiles(id),
  contenu text not null,
  is_systeme boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ticket_comments_ticket on public.ticket_commentaires(ticket_id, created_at);

-- ─── 6. Rapports d'intervention ─────────────────────────────────
create table if not exists public.ticket_rapports (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade unique,
  redige_par uuid references public.profiles(id),
  service_fait boolean not null default false,
  description_intervention text,
  duree_minutes integer,
  materiaux_utilises text,
  cout_estime numeric(10, 2),
  necessite_suivi boolean not null default false,
  notes_suivi text,
  created_at timestamptz not null default now()
);

-- ─── 7. Subscriptions Web Push (mutualisable inter-modules) ─────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_profile on public.push_subscriptions(profile_id);

-- ─── 8. Triggers ─────────────────────────────────────────────────
-- updated_at automatique
create or replace function public.tickets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.tickets_set_updated_at();

-- Journal automatique des changements de statut
create or replace function public.tickets_log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut is distinct from new.statut then
    insert into public.ticket_commentaires (ticket_id, auteur_id, contenu, is_systeme)
    values (
      new.id,
      coalesce(new.assigne_a, new.created_by),
      'Statut : ' || old.statut::text || ' → ' || new.statut::text,
      true
    );
  end if;
  if old.assigne_a is distinct from new.assigne_a and new.assigne_a is not null then
    new.assigne_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_status_log on public.tickets;
create trigger trg_tickets_status_log
  before update on public.tickets
  for each row execute function public.tickets_log_status_change();

-- ─── 9. Row Level Security ──────────────────────────────────────
alter table public.tickets             enable row level security;
alter table public.ticket_photos       enable row level security;
alter table public.ticket_commentaires enable row level security;
alter table public.ticket_rapports     enable row level security;
alter table public.push_subscriptions  enable row level security;

-- Helper : retourne true si user a accès au ticket via sa commune
create or replace function public.user_can_access_commune(p_commune_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'super_admin' or p.commune_id = p_commune_id)
  )
$$;
grant execute on function public.user_can_access_commune(uuid) to authenticated;

-- ── tickets ──
drop policy if exists "tickets_select_own_commune" on public.tickets;
create policy "tickets_select_own_commune"
  on public.tickets for select
  using (public.user_can_access_commune(commune_id));

drop policy if exists "tickets_insert_own_commune" on public.tickets;
create policy "tickets_insert_own_commune"
  on public.tickets for insert
  with check (
    public.user_can_access_commune(commune_id)
    and public.my_role() in ('admin', 'editor', 'super_admin')
  );

drop policy if exists "tickets_update_admin_or_assigne" on public.tickets;
create policy "tickets_update_admin_or_assigne"
  on public.tickets for update
  using (
    public.user_can_access_commune(commune_id)
    and (
      public.my_role() in ('admin', 'super_admin')
      or assigne_a = auth.uid()
      or created_by = auth.uid()
    )
  );

drop policy if exists "tickets_delete_admin" on public.tickets;
create policy "tickets_delete_admin"
  on public.tickets for delete
  using (
    public.user_can_access_commune(commune_id)
    and public.my_role() in ('admin', 'super_admin')
  );

-- ── ticket_photos ──
drop policy if exists "ticket_photos_select" on public.ticket_photos;
create policy "ticket_photos_select"
  on public.ticket_photos for select
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
  ));

drop policy if exists "ticket_photos_insert" on public.ticket_photos;
create policy "ticket_photos_insert"
  on public.ticket_photos for insert
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
  ));

drop policy if exists "ticket_photos_delete" on public.ticket_photos;
create policy "ticket_photos_delete"
  on public.ticket_photos for delete
  using (
    uploaded_by = auth.uid()
    or public.my_role() in ('admin', 'super_admin')
  );

-- ── ticket_commentaires ──
drop policy if exists "ticket_comments_select" on public.ticket_commentaires;
create policy "ticket_comments_select"
  on public.ticket_commentaires for select
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
  ));

drop policy if exists "ticket_comments_insert" on public.ticket_commentaires;
create policy "ticket_comments_insert"
  on public.ticket_commentaires for insert
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
  ));

-- ── ticket_rapports ──
drop policy if exists "ticket_rapports_select" on public.ticket_rapports;
create policy "ticket_rapports_select"
  on public.ticket_rapports for select
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
  ));

drop policy if exists "ticket_rapports_upsert" on public.ticket_rapports;
create policy "ticket_rapports_upsert"
  on public.ticket_rapports for insert
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
      and (public.my_role() in ('admin', 'editor', 'super_admin') or t.assigne_a = auth.uid())
  ));

drop policy if exists "ticket_rapports_update" on public.ticket_rapports;
create policy "ticket_rapports_update"
  on public.ticket_rapports for update
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and (t.assigne_a = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  ));

-- ── push_subscriptions : chacun gère les siennes ──
drop policy if exists "push_subs_personnelles" on public.push_subscriptions;
create policy "push_subs_personnelles"
  on public.push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ─── 10. Module catalogue ────────────────────────────────────────
insert into public.modules (id, name, tagline, icon, category, is_available, is_beta, display_order)
values (
  'tickets',
  'Tickets d''intervention',
  'Pilotez les signalements et interventions techniques de la commune',
  'Wrench',
  'technique',
  true,
  true,
  10
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  icon = excluded.icon,
  category = excluded.category,
  is_available = excluded.is_available,
  is_beta = excluded.is_beta;

-- ─── 11. Storage bucket pour les photos ─────────────────────────
-- Bucket privé : on génère des signed URLs côté serveur pour la lecture
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tickets-photos',
  'tickets-photos',
  false,
  5242880,                                      -- 5 MB max
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS : les membres de la commune lisent ; les uploaders + admins suppriment
drop policy if exists "tickets_photos_read" on storage.objects;
create policy "tickets_photos_read"
  on storage.objects for select
  using (
    bucket_id = 'tickets-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "tickets_photos_upload" on storage.objects;
create policy "tickets_photos_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'tickets-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "tickets_photos_delete" on storage.objects;
create policy "tickets_photos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'tickets-photos'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );

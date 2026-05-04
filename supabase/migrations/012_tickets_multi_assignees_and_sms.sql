-- ═══════════════════════════════════════════════════════════════
-- Migration 012 — Tickets : multi-assignés + notifications SMS
--
-- 1. Table ticket_assignees (N:N) pour multi-assignation
--    On garde tickets.assigne_a comme « assigné principal »
--    (rétro-compatibilité avec les UI / push existantes), et on
--    ajoute la liste complète via cette table.
--
-- 2. Téléphone optionnel sur profiles (pour SMS)
--
-- 3. Table notification_preferences :
--    - push_enabled / sms_enabled (opt-in stricte)
--    - sms_phone (peut surcharger profiles.phone si besoin)
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Multi-assignation ─────────────────────────────────────
create table if not exists public.ticket_assignees (
  ticket_id  uuid not null references public.tickets(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  primary key (ticket_id, profile_id)
);

create index if not exists idx_ticket_assignees_profile on public.ticket_assignees(profile_id);
create index if not exists idx_ticket_assignees_ticket  on public.ticket_assignees(ticket_id);

alter table public.ticket_assignees enable row level security;

-- Mêmes règles d'accès que les tickets de la commune
drop policy if exists "ticket_assignees_select" on public.ticket_assignees;
create policy "ticket_assignees_select"
  on public.ticket_assignees for select
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id and public.user_can_access_commune(t.commune_id)
  ));

drop policy if exists "ticket_assignees_modify" on public.ticket_assignees;
create policy "ticket_assignees_modify"
  on public.ticket_assignees for all
  using (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  ))
  with check (exists (
    select 1 from public.tickets t
    where t.id = ticket_id
      and public.user_can_access_commune(t.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  ));

-- Trigger : maintenir tickets.assigne_a synchrone (= 1er assigné)
create or replace function public.tickets_sync_primary_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_target uuid := coalesce(new.ticket_id, old.ticket_id);
  v_first  uuid;
begin
  select profile_id into v_first
    from public.ticket_assignees
   where ticket_id = v_target
   order by assigned_at asc
   limit 1;

  update public.tickets
     set assigne_a = v_first,
         assigne_at = case when v_first is null then null else coalesce(assigne_at, now()) end,
         statut = case
           when v_first is null and statut = 'assigne' then 'nouveau'
           when v_first is not null and statut = 'nouveau' then 'assigne'
           else statut
         end
   where id = v_target;
  return null;
end $$;

drop trigger if exists trg_ticket_assignees_sync on public.ticket_assignees;
create trigger trg_ticket_assignees_sync
  after insert or delete on public.ticket_assignees
  for each row execute function public.tickets_sync_primary_assignee();

-- ─── 2. Téléphone sur profiles (optionnel) ────────────────────
alter table public.profiles
  add column if not exists phone text;

-- ─── 3. Préférences de notification ──────────────────────────
create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  sms_phone text,
  -- Catégories d'événements pour lesquels notifier
  notify_assignment boolean not null default true,
  notify_urgent_unassigned boolean not null default true,
  notify_comment boolean not null default true,
  notify_closure boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_owner" on public.notification_preferences;
create policy "notif_prefs_owner"
  on public.notification_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Trigger updated_at
create or replace function public.notif_prefs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_notif_prefs_updated on public.notification_preferences;
create trigger trg_notif_prefs_updated
  before update on public.notification_preferences
  for each row execute function public.notif_prefs_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- Migration 017 — Module Gestion de projet
--
-- Pilotage des projets d'investissement de la commune sur un cycle
-- de vie standard en 7 étapes, avec portes de validation, parties
-- prenantes (RACI), financement, jalons, coûts d'exploitation sur
-- 10 ans, bilan, commissions municipales et séances avec émargement
-- électronique.
--
-- Multi-tenant strict : isolation par commune_id, RLS sur chaque
-- table, réservé aux élus/agents (admin, editor, super_admin).
--
-- Idempotente — rejouable sans danger.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. ENUMS ────────────────────────────────────────────────────
do $$ begin
  create type public.project_phase as enum (
    'emergence', 'faisabilite', 'decision_budget', 'financement',
    'conception_marches', 'realisation', 'bilan_cloture'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_competence as enum (
    'communale', 'intercommunale', 'a_verifier'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stakeholder_type as enum (
    'interne', 'institutionnelle', 'financeur', 'technique', 'citoyenne'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.stakeholder_role as enum (
    'decide', 'finance', 'execute', 'consulte', 'informe'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financing_status as enum (
    'a_demander', 'demandee', 'ar_recu', 'accordee', 'refusee', 'soldee'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.commission_member_role as enum ('president', 'membre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.commission_session_statut as enum ('planifiee', 'tenue', 'annulee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_decision_type as enum (
    'decision', 'avis_favorable', 'avis_defavorable', 'action'
  );
exception when duplicate_object then null; end $$;

-- ─── 2. commune_settings (taux d'inflation et d'actualisation) ──
create table if not exists public.commune_settings (
  commune_id uuid primary key references public.communes(id) on delete cascade,
  taux_inflation numeric(5,2) not null default 2.0
    check (taux_inflation >= 0 and taux_inflation <= 100),
  taux_actualisation numeric(5,2) not null default 4.0
    check (taux_actualisation >= 0 and taux_actualisation <= 100),
  updated_at timestamptz not null default now()
);

alter table public.commune_settings enable row level security;

drop policy if exists "commune_settings_select" on public.commune_settings;
create policy "commune_settings_select"
  on public.commune_settings for select
  using (public.user_can_access_commune(commune_id));

drop policy if exists "commune_settings_upsert" on public.commune_settings;
create policy "commune_settings_upsert"
  on public.commune_settings for insert
  with check (
    public.user_can_access_commune(commune_id)
    and public.my_role() in ('admin', 'super_admin')
  );

drop policy if exists "commune_settings_update" on public.commune_settings;
create policy "commune_settings_update"
  on public.commune_settings for update
  using (
    public.user_can_access_commune(commune_id)
    and public.my_role() in ('admin', 'super_admin')
  );

-- ─── 3. Table projects ──────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,

  -- Identité
  titre text not null,
  description text,
  objectifs text,
  competence public.project_competence not null default 'a_verifier',

  -- État
  phase public.project_phase not null default 'emergence',

  -- Pilotes
  pilote_elu uuid references public.profiles(id) on delete set null,
  pilote_agent uuid references public.profiles(id) on delete set null,

  -- Financement
  budget_estime numeric(14,2) not null default 0,
  sans_subvention boolean not null default false,

  -- Lien ticket d'origine (FK déclarée plus bas après création table tickets)
  source_ticket_id uuid,

  -- Taux d'actualisation : override projet (sinon commune_settings)
  taux_inflation numeric(5,2),
  taux_actualisation numeric(5,2),

  -- Bilan après réalisation
  cout_reel numeric(14,2),
  ecart numeric(14,2) generated always as (
    case when cout_reel is null then null
         else cout_reel - budget_estime end
  ) stored,
  explication_ecart text,

  date_creation timestamptz not null default now(),
  date_maj timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_projects_commune     on public.projects(commune_id);
create index if not exists idx_projects_phase       on public.projects(commune_id, phase);
create index if not exists idx_projects_pilote_elu  on public.projects(pilote_elu);
create index if not exists idx_projects_pilote_agent on public.projects(pilote_agent);
create index if not exists idx_projects_ticket      on public.projects(source_ticket_id);

-- FK source_ticket_id (la table tickets existe depuis 010)
do $$ begin
  alter table public.projects
    add constraint projects_source_ticket_fk
    foreign key (source_ticket_id) references public.tickets(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ─── 4. project_phase_log (journal des transitions) ─────────────
create table if not exists public.project_phase_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_phase public.project_phase,
  to_phase public.project_phase not null,
  user_id uuid references public.profiles(id) on delete set null,
  commentaire text,
  forced boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_phase_log_project on public.project_phase_log(project_id, created_at desc);

-- ─── 5. project_subscribers ─────────────────────────────────────
create table if not exists public.project_subscribers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists idx_project_subs_user on public.project_subscribers(user_id);

-- ─── 6. stakeholders + project_stakeholders (RACI) ──────────────
create table if not exists public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  nom text not null,
  organisation text,
  email text,
  telephone text,
  type public.stakeholder_type not null default 'institutionnelle',
  created_at timestamptz not null default now()
);
create index if not exists idx_stakeholders_commune on public.stakeholders(commune_id);

create table if not exists public.project_stakeholders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stakeholder_id uuid not null references public.stakeholders(id) on delete cascade,
  role public.stakeholder_role not null,
  phase public.project_phase,
  created_at timestamptz not null default now()
);
-- Unicité : (project, stakeholder, role, phase) — phase NULL géré via index partiel
create unique index if not exists uq_project_stakeholders_with_phase
  on public.project_stakeholders(project_id, stakeholder_id, role, phase)
  where phase is not null;
create unique index if not exists uq_project_stakeholders_no_phase
  on public.project_stakeholders(project_id, stakeholder_id, role)
  where phase is null;
create index if not exists idx_proj_stakeholders_proj on public.project_stakeholders(project_id);

-- ─── 7. financings ──────────────────────────────────────────────
create table if not exists public.financings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  financeur text not null,
  montant_demande numeric(14,2),
  montant_obtenu numeric(14,2),
  statut public.financing_status not null default 'a_demander',
  date_demande date,
  date_ar date,
  date_decision date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_financings_project on public.financings(project_id);
create index if not exists idx_financings_statut  on public.financings(project_id, statut);

-- ─── 8. milestones ──────────────────────────────────────────────
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase not null,
  libelle text not null,
  echeance date,
  fait boolean not null default false,
  responsable_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_milestones_project on public.milestones(project_id);
create index if not exists idx_milestones_echeance on public.milestones(project_id, echeance) where fait = false;

-- ─── 9. project_lifecycle_costs ─────────────────────────────────
create table if not exists public.project_lifecycle_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  annee smallint not null check (annee between 1 and 10),
  cout_fonctionnement numeric(14,2) not null default 0,
  cout_entretien numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id, annee)
);
create index if not exists idx_lifecycle_project on public.project_lifecycle_costs(project_id);

-- ─── 10. project_documents ──────────────────────────────────────
create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default 'autre'
    check (type in ('fiche_projet', 'deliberation', 'devis', 'plan_financement', 'autre')),
  nom text not null,
  url text not null,
  storage_path text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_project_documents_proj on public.project_documents(project_id);

-- ─── 11. Commissions ────────────────────────────────────────────
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references public.communes(id) on delete cascade,
  nom text not null,
  description text,
  responsable_user_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_commissions_commune on public.commissions(commune_id);

create table if not exists public.commission_members (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.commission_member_role not null default 'membre',
  created_at timestamptz not null default now(),
  unique (commission_id, user_id)
);
create index if not exists idx_commission_members_user on public.commission_members(user_id);

create table if not exists public.commission_projects (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (commission_id, project_id)
);
create index if not exists idx_commission_projects_proj on public.commission_projects(project_id);

create table if not exists public.commission_sessions (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  date_seance timestamptz not null,
  lieu text,
  ordre_du_jour text,
  statut public.commission_session_statut not null default 'planifiee',
  secretaire_de_seance_user_id uuid references public.profiles(id) on delete set null,
  compte_rendu text,
  compte_rendu_valide boolean not null default false,
  compte_rendu_valide_at timestamptz,
  compte_rendu_valide_by uuid references public.profiles(id) on delete set null,
  compte_rendu_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_commission_sessions on public.commission_sessions(commission_id, date_seance desc);

create table if not exists public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.commission_sessions(id) on delete cascade,
  conseiller_user_id uuid not null references public.profiles(id) on delete cascade,
  present boolean,
  signature_data text,                          -- base64 PNG ; null = pas encore signé
  signe_le timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, conseiller_user_id)
);
create index if not exists idx_attendance_session on public.session_attendance(session_id);

create table if not exists public.session_decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.commission_sessions(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  libelle text not null,
  type public.session_decision_type not null,
  responsable_user_id uuid references public.profiles(id) on delete set null,
  echeance date,
  created_at timestamptz not null default now()
);
create index if not exists idx_session_decisions_session on public.session_decisions(session_id);
create index if not exists idx_session_decisions_project on public.session_decisions(project_id);

-- ─── 12. Lien tickets → projets ─────────────────────────────────
alter table public.tickets
  add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists idx_tickets_project on public.tickets(project_id);

-- ─── 13. Extension notification_preferences ─────────────────────
alter table public.notification_preferences
  add column if not exists notify_project_phase     boolean not null default true,
  add column if not exists notify_project_milestone boolean not null default true,
  add column if not exists notify_project_financing boolean not null default true,
  add column if not exists notify_commission        boolean not null default true;

-- ─── 14. Triggers ───────────────────────────────────────────────
-- updated_at générique
create or replace function public.projects_set_date_maj()
returns trigger language plpgsql as $$
begin
  new.date_maj := now();
  return new;
end $$;

drop trigger if exists trg_projects_date_maj on public.projects;
create trigger trg_projects_date_maj
  before update on public.projects
  for each row execute function public.projects_set_date_maj();

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_financings_updated_at on public.financings;
create trigger trg_financings_updated_at
  before update on public.financings
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_milestones_updated_at on public.milestones;
create trigger trg_milestones_updated_at
  before update on public.milestones
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_lifecycle_updated_at on public.project_lifecycle_costs;
create trigger trg_lifecycle_updated_at
  before update on public.project_lifecycle_costs
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_sessions_updated_at on public.commission_sessions;
create trigger trg_sessions_updated_at
  before update on public.commission_sessions
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_commune_settings_updated_at on public.commune_settings;
create trigger trg_commune_settings_updated_at
  before update on public.commune_settings
  for each row execute function public.tg_set_updated_at();

-- Auto-abonnement des pilotes (INSERT + UPDATE)
create or replace function public.projects_autosubscribe_pilotes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pilote_elu is not null then
    insert into public.project_subscribers(project_id, user_id)
    values (new.id, new.pilote_elu)
    on conflict do nothing;
  end if;
  if new.pilote_agent is not null then
    insert into public.project_subscribers(project_id, user_id)
    values (new.id, new.pilote_agent)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_projects_autosub_ins on public.projects;
create trigger trg_projects_autosub_ins
  after insert on public.projects
  for each row execute function public.projects_autosubscribe_pilotes();

drop trigger if exists trg_projects_autosub_upd on public.projects;
create trigger trg_projects_autosub_upd
  after update of pilote_elu, pilote_agent on public.projects
  for each row execute function public.projects_autosubscribe_pilotes();

-- Décision de type 'action' → jalon sur le projet lié
create or replace function public.session_decision_to_milestone()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phase public.project_phase;
begin
  if new.type = 'action' and new.project_id is not null then
    select phase into v_phase from public.projects where id = new.project_id;
    insert into public.milestones (project_id, phase, libelle, echeance, responsable_user_id)
    values (new.project_id, coalesce(v_phase, 'emergence'), new.libelle, new.echeance, new.responsable_user_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_session_decision_milestone on public.session_decisions;
create trigger trg_session_decision_milestone
  after insert on public.session_decisions
  for each row execute function public.session_decision_to_milestone();

-- ─── 15. Machine à états : fonctions métier ─────────────────────
-- Ordre des phases (pour vérifier les sauts)
create or replace function public.project_phase_index(p public.project_phase)
returns int language sql immutable as $$
  select case p
    when 'emergence' then 1
    when 'faisabilite' then 2
    when 'decision_budget' then 3
    when 'financement' then 4
    when 'conception_marches' then 5
    when 'realisation' then 6
    when 'bilan_cloture' then 7
  end
$$;

-- Vérifie si la transition est autorisée. Retourne JSONB :
--   { ok: bool, reason?: text, warnings?: text[], require_comment?: bool }
create or replace function public.project_can_advance(
  p_project_id uuid,
  p_to_phase public.project_phase
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_project public.projects%rowtype;
  v_from_idx int;
  v_to_idx int;
  v_step int;
  v_has_subv boolean;
  v_warnings text[] := array[]::text[];
  v_decide_count int;
  v_financeur_count int;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Projet introuvable');
  end if;

  v_from_idx := public.project_phase_index(v_project.phase);
  v_to_idx := public.project_phase_index(p_to_phase);

  if v_from_idx = v_to_idx then
    return jsonb_build_object('ok', false, 'reason', 'Le projet est déjà à cette étape');
  end if;

  v_step := v_to_idx - v_from_idx;

  -- Recul : autorisé mais commentaire obligatoire
  if v_step < 0 then
    return jsonb_build_object(
      'ok', true,
      'direction', 'backward',
      'require_comment', true
    );
  end if;

  -- Saut de plus d'une étape : nécessite force
  if v_step > 1 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Sauter une étape n''est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.',
      'require_force', true
    );
  end if;

  -- Porte de financement : transition VERS realisation
  if p_to_phase = 'realisation' then
    select exists (
      select 1 from public.financings
      where project_id = p_project_id
        and statut in ('ar_recu', 'accordee', 'soldee')
    ) into v_has_subv;
    if not (v_has_subv or v_project.sans_subvention) then
      return jsonb_build_object(
        'ok', false,
        'reason', 'Impossible de lancer la réalisation : aucune subvention n''a reçu d''accusé de réception et l''autofinancement n''a pas été déclaré. Demandez vos subventions avant tout commencement, ou cochez « sans subvention ».'
      );
    end if;
  end if;

  -- Bilan obligatoire pour entrer dans bilan_cloture
  if p_to_phase = 'bilan_cloture' then
    if v_project.cout_reel is null or coalesce(trim(v_project.explication_ecart), '') = '' then
      return jsonb_build_object(
        'ok', false,
        'reason', 'Bilan obligatoire avant clôture : renseignez le coût réel et l''explication de l''écart.'
      );
    end if;
  end if;

  -- Warnings non bloquants
  if p_to_phase = 'decision_budget' then
    select count(*) into v_decide_count
      from public.project_stakeholders
      where project_id = p_project_id and role = 'decide';
    if v_decide_count = 0 then
      v_warnings := array_append(v_warnings,
        'Aucune partie prenante avec le rôle « décide » n''est associée.');
    end if;
  end if;

  if p_to_phase = 'financement' then
    select count(*) into v_financeur_count
      from public.project_stakeholders ps
      join public.stakeholders s on s.id = ps.stakeholder_id
      where ps.project_id = p_project_id
        and s.type = 'financeur';
    if v_financeur_count = 0 then
      v_warnings := array_append(v_warnings,
        'Aucune partie prenante de type « financeur » n''est associée.');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'direction', 'forward',
    'warnings', to_jsonb(v_warnings)
  );
end $$;

grant execute on function public.project_can_advance(uuid, public.project_phase) to authenticated;

-- RPC d'écriture des transitions (source de vérité). Vérifie tout
-- côté serveur. Si force=true, l'appelant doit être admin/super_admin
-- (la RPC le contrôle ; les API doublent côté Node).
create or replace function public.advance_project_phase(
  p_project_id uuid,
  p_to_phase public.project_phase,
  p_commentaire text,
  p_force boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_can jsonb;
  v_role text;
  v_from public.project_phase;
  v_from_idx int;
  v_to_idx int;
  v_step int;
  v_commune uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'Non authentifié');
  end if;

  select phase, commune_id into v_from, v_commune
    from public.projects where id = p_project_id;
  if v_from is null then
    return jsonb_build_object('ok', false, 'reason', 'Projet introuvable');
  end if;

  -- Vérif d'accès à la commune
  if not public.user_can_access_commune(v_commune) then
    return jsonb_build_object('ok', false, 'reason', 'Accès refusé');
  end if;

  select public.my_role() into v_role;
  if v_role not in ('admin', 'editor', 'super_admin') then
    return jsonb_build_object('ok', false, 'reason', 'Permissions insuffisantes');
  end if;

  v_from_idx := public.project_phase_index(v_from);
  v_to_idx := public.project_phase_index(p_to_phase);
  v_step := v_to_idx - v_from_idx;

  -- Recul : commentaire obligatoire
  if v_step < 0 and coalesce(trim(p_commentaire), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'Un commentaire est obligatoire pour reculer d''étape.');
  end if;

  -- Saut : nécessite force ET admin/super_admin ET commentaire
  if v_step > 1 then
    if not p_force then
      return jsonb_build_object(
        'ok', false,
        'reason', 'Sauter une étape n''est pas autorisé. Utilisez « forcer » (admin uniquement) avec un commentaire.',
        'require_force', true
      );
    end if;
    if v_role not in ('admin', 'super_admin') then
      return jsonb_build_object('ok', false, 'reason', 'Seul un administrateur peut forcer un saut d''étape.');
    end if;
    if coalesce(trim(p_commentaire), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'Un commentaire est obligatoire pour forcer une transition.');
    end if;
  end if;

  -- Vérif règles métier (porte, bilan, etc.)
  v_can := public.project_can_advance(p_project_id, p_to_phase);
  if not (v_can->>'ok')::boolean then
    -- Si on saute ET on force, on contourne la règle de saut mais PAS
    -- la porte de financement ni le bilan obligatoire.
    if v_step > 1 and p_force and (v_can->>'reason') like 'Sauter une étape%' then
      -- la règle de saut peut être contournée par force, on continue
      null;
    else
      return v_can;
    end if;
  end if;

  -- Application de la transition
  update public.projects set phase = p_to_phase where id = p_project_id;

  insert into public.project_phase_log (project_id, from_phase, to_phase, user_id, commentaire, forced)
  values (p_project_id, v_from, p_to_phase, v_user, nullif(trim(p_commentaire), ''), v_step > 1 and p_force);

  return jsonb_build_object(
    'ok', true,
    'from_phase', v_from,
    'to_phase', p_to_phase,
    'warnings', coalesce(v_can->'warnings', '[]'::jsonb)
  );
end $$;

grant execute on function public.advance_project_phase(uuid, public.project_phase, text, boolean) to authenticated;

-- Coût global (nominal + actualisé sur 10 ans). Utilise les taux du
-- projet s'ils sont renseignés, sinon ceux de commune_settings, sinon
-- les defaults (2% / 4%).
create or replace function public.project_global_cost(p_project_id uuid)
returns table (
  invest numeric,
  total_nominal numeric,
  total_actualise numeric,
  taux_inflation_used numeric,
  taux_actualisation_used numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_project public.projects%rowtype;
  v_settings public.commune_settings%rowtype;
  v_infl numeric;
  v_act numeric;
  v_invest numeric;
  v_nominal numeric := 0;
  v_actualise numeric := 0;
  v_rec record;
  v_constant numeric;
  v_nom numeric;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then return; end if;

  select * into v_settings from public.commune_settings where commune_id = v_project.commune_id;

  v_infl := coalesce(v_project.taux_inflation, v_settings.taux_inflation, 2.0) / 100.0;
  v_act  := coalesce(v_project.taux_actualisation, v_settings.taux_actualisation, 4.0) / 100.0;
  v_invest := coalesce(v_project.budget_estime, 0);

  for v_rec in
    select annee, coalesce(cout_fonctionnement, 0) + coalesce(cout_entretien, 0) as cout
      from public.project_lifecycle_costs
      where project_id = p_project_id
      order by annee
  loop
    v_constant := v_rec.cout;
    -- nominal année n : constant × (1 + inflation)^(n-1)
    v_nom := v_constant * power(1 + v_infl, v_rec.annee - 1);
    v_nominal := v_nominal + v_nom;
    -- actualisé année n : nominal / (1 + actualisation)^n
    v_actualise := v_actualise + v_nom / power(1 + v_act, v_rec.annee);
  end loop;

  invest := v_invest;
  total_nominal := v_invest + v_nominal;
  total_actualise := v_invest + v_actualise;
  taux_inflation_used := v_infl * 100.0;
  taux_actualisation_used := v_act * 100.0;
  return next;
end $$;

grant execute on function public.project_global_cost(uuid) to authenticated;

-- ─── 16. Row Level Security — toutes les tables ─────────────────
alter table public.projects                  enable row level security;
alter table public.project_phase_log         enable row level security;
alter table public.project_subscribers       enable row level security;
alter table public.stakeholders              enable row level security;
alter table public.project_stakeholders      enable row level security;
alter table public.financings                enable row level security;
alter table public.milestones                enable row level security;
alter table public.project_lifecycle_costs   enable row level security;
alter table public.project_documents         enable row level security;
alter table public.commissions               enable row level security;
alter table public.commission_members        enable row level security;
alter table public.commission_projects       enable row level security;
alter table public.commission_sessions       enable row level security;
alter table public.session_attendance        enable row level security;
alter table public.session_decisions         enable row level security;

-- Helper : un user peut éditer un projet ?
create or replace function public.user_can_edit_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and public.user_can_access_commune(p.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')
  )
$$;
grant execute on function public.user_can_edit_project(uuid) to authenticated;

-- ── projects ──
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects for insert
  with check (public.user_can_access_commune(commune_id)
              and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects for update
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete" on public.projects for delete
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'super_admin'));

-- ── project_phase_log : lecture pour membres commune, insert via RPC seulement ──
drop policy if exists "phase_log_select" on public.project_phase_log;
create policy "phase_log_select" on public.project_phase_log for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and public.user_can_access_commune(p.commune_id)
  ));
-- Pas de policy INSERT publique : la RPC advance_project_phase écrit en SECURITY DEFINER

-- ── project_subscribers ──
drop policy if exists "subscribers_select" on public.project_subscribers;
create policy "subscribers_select" on public.project_subscribers for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)));

drop policy if exists "subscribers_insert" on public.project_subscribers;
create policy "subscribers_insert" on public.project_subscribers for insert
  with check (public.user_can_edit_project(project_id));

drop policy if exists "subscribers_delete" on public.project_subscribers;
create policy "subscribers_delete" on public.project_subscribers for delete
  using (public.user_can_edit_project(project_id) or user_id = auth.uid());

-- ── stakeholders ──
drop policy if exists "stakeholders_select" on public.stakeholders;
create policy "stakeholders_select" on public.stakeholders for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "stakeholders_cud" on public.stakeholders;
create policy "stakeholders_cud" on public.stakeholders for all
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'))
  with check (public.user_can_access_commune(commune_id)
              and public.my_role() in ('admin', 'editor', 'super_admin'));

-- ── project_stakeholders ──
drop policy if exists "proj_stakeholders_select" on public.project_stakeholders;
create policy "proj_stakeholders_select" on public.project_stakeholders for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "proj_stakeholders_cud" on public.project_stakeholders;
create policy "proj_stakeholders_cud" on public.project_stakeholders for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── financings ──
drop policy if exists "financings_select" on public.financings;
create policy "financings_select" on public.financings for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "financings_cud" on public.financings;
create policy "financings_cud" on public.financings for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── milestones ──
drop policy if exists "milestones_select" on public.milestones;
create policy "milestones_select" on public.milestones for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "milestones_cud" on public.milestones;
create policy "milestones_cud" on public.milestones for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── project_lifecycle_costs ──
drop policy if exists "lifecycle_select" on public.project_lifecycle_costs;
create policy "lifecycle_select" on public.project_lifecycle_costs for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "lifecycle_cud" on public.project_lifecycle_costs;
create policy "lifecycle_cud" on public.project_lifecycle_costs for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── project_documents ──
drop policy if exists "documents_select" on public.project_documents;
create policy "documents_select" on public.project_documents for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "documents_cud" on public.project_documents;
create policy "documents_cud" on public.project_documents for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── commissions ──
drop policy if exists "commissions_select" on public.commissions;
create policy "commissions_select" on public.commissions for select
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'editor', 'super_admin'));

drop policy if exists "commissions_cud" on public.commissions;
create policy "commissions_cud" on public.commissions for all
  using (public.user_can_access_commune(commune_id)
         and public.my_role() in ('admin', 'super_admin'))
  with check (public.user_can_access_commune(commune_id)
              and public.my_role() in ('admin', 'super_admin'));

-- ── commission_members ──
drop policy if exists "commission_members_select" on public.commission_members;
create policy "commission_members_select" on public.commission_members for select
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id and public.user_can_access_commune(c.commune_id)));

drop policy if exists "commission_members_cud" on public.commission_members;
create policy "commission_members_cud" on public.commission_members for all
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id
                   and public.user_can_access_commune(c.commune_id)
                   and public.my_role() in ('admin', 'super_admin')))
  with check (exists (select 1 from public.commissions c
                      where c.id = commission_id
                        and public.user_can_access_commune(c.commune_id)
                        and public.my_role() in ('admin', 'super_admin')));

-- ── commission_projects ──
drop policy if exists "commission_projects_select" on public.commission_projects;
create policy "commission_projects_select" on public.commission_projects for select
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id and public.user_can_access_commune(c.commune_id)));

drop policy if exists "commission_projects_cud" on public.commission_projects;
create policy "commission_projects_cud" on public.commission_projects for all
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id
                   and public.user_can_access_commune(c.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')))
  with check (exists (select 1 from public.commissions c
                      where c.id = commission_id
                        and public.user_can_access_commune(c.commune_id)
                        and public.my_role() in ('admin', 'editor', 'super_admin')));

-- ── commission_sessions ──
drop policy if exists "commission_sessions_select" on public.commission_sessions;
create policy "commission_sessions_select" on public.commission_sessions for select
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id and public.user_can_access_commune(c.commune_id)));

drop policy if exists "commission_sessions_cud" on public.commission_sessions;
create policy "commission_sessions_cud" on public.commission_sessions for all
  using (exists (select 1 from public.commissions c
                 where c.id = commission_id
                   and public.user_can_access_commune(c.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')))
  with check (exists (select 1 from public.commissions c
                      where c.id = commission_id
                        and public.user_can_access_commune(c.commune_id)
                        and public.my_role() in ('admin', 'editor', 'super_admin')));

-- ── session_attendance : lecture pour membres commune, écriture par l'intéressé ou un admin ──
drop policy if exists "attendance_select" on public.session_attendance;
create policy "attendance_select" on public.session_attendance for select
  using (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id and public.user_can_access_commune(c.commune_id)));

drop policy if exists "attendance_cud" on public.session_attendance;
create policy "attendance_cud" on public.session_attendance for all
  using (
    conseiller_user_id = auth.uid()
    or exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'super_admin'))
  )
  with check (
    conseiller_user_id = auth.uid()
    or exists (
      select 1 from public.commission_sessions s
      join public.commissions c on c.id = s.commission_id
      where s.id = session_id
        and public.user_can_access_commune(c.commune_id)
        and public.my_role() in ('admin', 'super_admin'))
  );

-- ── session_decisions ──
drop policy if exists "decisions_select" on public.session_decisions;
create policy "decisions_select" on public.session_decisions for select
  using (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id and public.user_can_access_commune(c.commune_id)));

drop policy if exists "decisions_cud" on public.session_decisions;
create policy "decisions_cud" on public.session_decisions for all
  using (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id
      and public.user_can_access_commune(c.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')))
  with check (exists (
    select 1 from public.commission_sessions s
    join public.commissions c on c.id = s.commission_id
    where s.id = session_id
      and public.user_can_access_commune(c.commune_id)
      and public.my_role() in ('admin', 'editor', 'super_admin')));

-- ─── 17. Module catalogue ───────────────────────────────────────
insert into public.modules (id, name, tagline, icon, category, is_available, is_beta, display_order)
values (
  'projects',
  'Gestion de projet',
  'Pilotez vos projets d''investissement sur leur cycle de vie complet',
  'FolderKanban',
  'pilotage',
  true,
  true,
  20
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  icon = excluded.icon,
  category = excluded.category,
  is_available = excluded.is_available,
  is_beta = excluded.is_beta;

-- ─── 18. Storage buckets ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents', 'project-documents', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commission-pdfs', 'commission-pdfs', false, 20971520,
  array['application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS
drop policy if exists "project_docs_read" on storage.objects;
create policy "project_docs_read" on storage.objects for select
  using (bucket_id = 'project-documents' and auth.role() = 'authenticated');

drop policy if exists "project_docs_upload" on storage.objects;
create policy "project_docs_upload" on storage.objects for insert
  with check (bucket_id = 'project-documents' and auth.role() = 'authenticated');

drop policy if exists "project_docs_delete" on storage.objects;
create policy "project_docs_delete" on storage.objects for delete
  using (
    bucket_id = 'project-documents'
    and (owner = auth.uid() or public.my_role() in ('admin', 'super_admin'))
  );

drop policy if exists "commission_pdfs_read" on storage.objects;
create policy "commission_pdfs_read" on storage.objects for select
  using (bucket_id = 'commission-pdfs' and auth.role() = 'authenticated');

drop policy if exists "commission_pdfs_upload" on storage.objects;
create policy "commission_pdfs_upload" on storage.objects for insert
  with check (bucket_id = 'commission-pdfs' and auth.role() = 'authenticated');

drop policy if exists "commission_pdfs_delete" on storage.objects;
create policy "commission_pdfs_delete" on storage.objects for delete
  using (
    bucket_id = 'commission-pdfs'
    and public.my_role() in ('admin', 'super_admin')
  );

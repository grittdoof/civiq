-- ═══════════════════════════════════════════════════════════════
-- Migration 029 — Délibérations, autorisations, communications, budget
-- ═══════════════════════════════════════════════════════════════
--
-- 4 nouvelles entités rattachées à un projet (et à une phase) qui
-- couvrent les livrables typés introduits par les nouveaux gabarits
-- (event, tracking) et enrichissent le gabarit investment :
--
--   • project_deliberations     — passage en instance (Conseil municipal…)
--   • project_authorizations    — arrêtés, déclarations, autorisations
--   • project_communications    — actions de communication
--   • project_budget_lines      — budget INTERNE (≠ financings externes)
--
-- Modélisation propre (plutôt que de tout rabattre sur des documents
-- taggués) : chaque entité a son cycle de vie et ses champs spécifiques.
--
-- RLS aligné sur les autres tables projet : lecture pour rôles
-- admin/editor/super_admin de la commune, écriture via
-- user_can_edit_project(project_id).
--
-- Idempotente — rejouable sans danger.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. project_deliberations ───────────────────────────────────
create table if not exists public.project_deliberations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase not null,
  date_seance date not null,
  numero text,
  objet text not null,
  lien_pv text,
  document_id uuid references public.project_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_deliberations is
  'Passages en instance d''un projet (Conseil municipal, bureau…). '
  'Rattaché à une phase précise du projet.';
comment on column public.project_deliberations.numero is
  'Numéro de la délibération si attribué (ex : « 2026-03-15-007 »).';
comment on column public.project_deliberations.document_id is
  'Pièce jointe optionnelle (PV scanné, extrait du registre).';

create index if not exists idx_project_deliberations_proj
  on public.project_deliberations(project_id, phase);
create index if not exists idx_project_deliberations_date
  on public.project_deliberations(project_id, date_seance);

-- ─── 2. project_authorizations ──────────────────────────────────
-- Arrêtés municipaux, déclarations préfectorales, SACEM, sécurité…
-- Statuts en text + CHECK : plus souple qu'un enum pour ajouter
-- des types futurs sans migration.
create table if not exists public.project_authorizations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase not null,
  type text not null
    check (type in (
      'arrete_municipal', 'declaration_prefecture',
      'sacem', 'securite', 'erp', 'debit_boisson', 'autre'
    )),
  libelle text not null,
  statut text not null default 'a_obtenir'
    check (statut in ('a_obtenir', 'depose', 'obtenu', 'refuse')),
  echeance date,
  obtenu_le date,
  document_id uuid references public.project_documents(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_authorizations is
  'Autorisations administratives nécessaires : arrêtés municipaux, '
  'déclarations préfectorales, SACEM, dossier sécurité, ERP, etc.';
comment on column public.project_authorizations.echeance is
  'Date butoir de dépôt ou d''obtention (pour les rappels).';

create index if not exists idx_project_authorizations_proj
  on public.project_authorizations(project_id, phase);
create index if not exists idx_project_authorizations_statut
  on public.project_authorizations(project_id, statut)
  where statut in ('a_obtenir', 'depose');
create index if not exists idx_project_authorizations_echeance
  on public.project_authorizations(project_id, echeance)
  where echeance is not null and statut <> 'obtenu';

-- ─── 3. project_communications ──────────────────────────────────
create table if not exists public.project_communications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase not null,
  canal text not null
    check (canal in (
      'affiche', 'presse', 'reseaux', 'site', 'agenda',
      'mailing', 'panneau', 'autre'
    )),
  libelle text not null,
  date_prevue date,
  date_diffusion date,
  statut text not null default 'a_faire'
    check (statut in ('a_faire', 'planifie', 'diffuse')),
  lien text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_communications is
  'Actions de communication associées au projet (affiches, presse, '
  'réseaux sociaux, site, mailings…). Rattachées à une phase.';

create index if not exists idx_project_communications_proj
  on public.project_communications(project_id, phase);
create index if not exists idx_project_communications_date
  on public.project_communications(project_id, date_prevue)
  where date_prevue is not null;

-- ─── 4. project_budget_lines ────────────────────────────────────
-- Budget INTERNE consolidé du projet (≠ financings qui modélisent
-- des financements externes par dispositif). Une ligne = une recette
-- ou une dépense prévue. La phase est optionnelle (un budget peut
-- être transversal au projet).
create table if not exists public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase public.project_phase,
  sens text not null
    check (sens in ('depense', 'recette')),
  categorie text
    check (categorie is null or categorie in (
      'buvette', 'billetterie', 'mecenat', 'subvention',
      'prestataire', 'materiel', 'location', 'personnel',
      'communication', 'autre'
    )),
  libelle text not null,
  montant_prevu numeric(14,2),
  montant_reel numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_budget_lines is
  'Lignes du budget interne du projet (dépenses et recettes propres). '
  'À distinguer de financings qui modélise les financements externes '
  'avec leur cycle d''éligibilité.';
comment on column public.project_budget_lines.phase is
  'Phase de rattachement (nullable : budget transversal possible).';

create index if not exists idx_project_budget_lines_proj
  on public.project_budget_lines(project_id, phase);
create index if not exists idx_project_budget_lines_sens
  on public.project_budget_lines(project_id, sens);

-- ─── 5. Triggers updated_at ─────────────────────────────────────
drop trigger if exists trg_deliberations_updated_at on public.project_deliberations;
create trigger trg_deliberations_updated_at
  before update on public.project_deliberations
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_authorizations_updated_at on public.project_authorizations;
create trigger trg_authorizations_updated_at
  before update on public.project_authorizations
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_communications_updated_at on public.project_communications;
create trigger trg_communications_updated_at
  before update on public.project_communications
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_budget_lines_updated_at on public.project_budget_lines;
create trigger trg_budget_lines_updated_at
  before update on public.project_budget_lines
  for each row execute function public.tg_set_updated_at();

-- ─── 6. Row Level Security ──────────────────────────────────────
alter table public.project_deliberations  enable row level security;
alter table public.project_authorizations enable row level security;
alter table public.project_communications enable row level security;
alter table public.project_budget_lines   enable row level security;

-- ── project_deliberations ──
drop policy if exists "deliberations_select" on public.project_deliberations;
create policy "deliberations_select" on public.project_deliberations for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "deliberations_cud" on public.project_deliberations;
create policy "deliberations_cud" on public.project_deliberations for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── project_authorizations ──
drop policy if exists "authorizations_select" on public.project_authorizations;
create policy "authorizations_select" on public.project_authorizations for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "authorizations_cud" on public.project_authorizations;
create policy "authorizations_cud" on public.project_authorizations for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── project_communications ──
drop policy if exists "communications_select" on public.project_communications;
create policy "communications_select" on public.project_communications for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "communications_cud" on public.project_communications;
create policy "communications_cud" on public.project_communications for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ── project_budget_lines ──
drop policy if exists "budget_lines_select" on public.project_budget_lines;
create policy "budget_lines_select" on public.project_budget_lines for select
  using (exists (select 1 from public.projects p
                 where p.id = project_id
                   and public.user_can_access_commune(p.commune_id)
                   and public.my_role() in ('admin', 'editor', 'super_admin')));

drop policy if exists "budget_lines_cud" on public.project_budget_lines;
create policy "budget_lines_cud" on public.project_budget_lines for all
  using (public.user_can_edit_project(project_id))
  with check (public.user_can_edit_project(project_id));

-- ═══════════════════════════════════════════════════════════════
-- Fin migration 029
-- ═══════════════════════════════════════════════════════════════

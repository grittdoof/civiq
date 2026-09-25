-- ═══════════════════════════════════════════════════════════════
-- 037 — Projets lot A : paramètres communaux + référentiel des types
--
-- 1. commune_settings (table existante, vide) devient le paramétrage
--    projets de la commune (brief §2.1, blocs A/B/C). Étendue plutôt que
--    doublonnée (décision Q6).
--      A. Délégation du conseil au maire (art. L.2122-22 4° CGCT) :
--         seuil + n° et date de la délibération.
--      B. Guide interne des achats : interrupteur + 2 champs.
--      C. Taux FCTVA, code INSEE.
-- 2. types_projet : référentiel global (investissement, événement, suivi
--    simple) avec jalons modèles et blocs actifs, extensible sans enum.
--    projects.type_code le référence ; projects.type (enum) reste
--    synchronisé par trigger le temps de la transition (lot B).
--
-- Idempotente. Retour arrière : supabase/rollback/037_commune_parametres_types_projet_down.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Paramètres communaux ───
alter table public.commune_settings
  add column if not exists seuil_delegation_maire_ht    numeric(14,2),
  add column if not exists delegation_deliberation_num  text,
  add column if not exists delegation_deliberation_date date,
  add column if not exists regles_internes_actives      boolean not null default false,
  add column if not exists nb_devis_exige               integer not null default 3,
  add column if not exists seuil_devis_exige_ht         numeric(14,2) not null default 5000,
  add column if not exists taux_fctva                   numeric(6,3) not null default 16.404,
  add column if not exists code_insee                   text,
  add column if not exists updated_by                   uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.commune_settings add constraint commune_settings_seuil_delegation_check
    check (seuil_delegation_maire_ht is null or seuil_delegation_maire_ht >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  -- Le seuil n'a de valeur que rattaché à sa délibération.
  alter table public.commune_settings add constraint commune_settings_delegation_complete_check
    check (seuil_delegation_maire_ht is null
           or (btrim(coalesce(delegation_deliberation_num, '')) <> '' and delegation_deliberation_date is not null));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_settings add constraint commune_settings_nb_devis_check
    check (nb_devis_exige between 1 and 10);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_settings add constraint commune_settings_seuil_devis_check
    check (seuil_devis_exige_ht >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_settings add constraint commune_settings_fctva_check
    check (taux_fctva between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commune_settings add constraint commune_settings_insee_check
    check (code_insee is null or code_insee ~ '^([0-9]{5}|2[AB][0-9]{3})$');
exception when duplicate_object then null; end $$;

comment on column public.commune_settings.seuil_delegation_maire_ht is
  'Montant HT jusqu''auquel le maire signe un marché sans délibération (délégation L.2122-22 4° CGCT). NULL = alerte désactivée.';
comment on column public.commune_settings.regles_internes_actives is
  'Guide interne des achats délibéré par la commune. false = aucun bloc affiché.';

-- Une ligne par commune (valeurs par défaut) : la lecture ne renvoie jamais vide.
insert into public.commune_settings (commune_id)
select id from public.communes
on conflict (commune_id) do nothing;

-- ─── 2. Référentiel des types de projet ───
create table if not exists public.types_projet (
  code           text primary key check (code ~ '^[a-z_]+$'),
  libelle        text not null,
  accroche       text not null,
  exemples       text[] not null default '{}',
  couleur        text not null check (couleur ~ '^#[0-9A-Fa-f]{6}$'),
  icone          text not null,
  -- Jalons proposés à la création : [{ libelle, offset_jours?, conditionnel?, aide? }]
  -- offset_jours : position relative à la date de l'événement (J-n négatif).
  jalons_modele  jsonb not null default '[]'::jsonb,
  -- Blocs / onglets actifs dans l'écran de vie du projet.
  blocs_actifs   jsonb not null default '[]'::jsonb,
  legacy_type    public.project_type unique,
  ordre          integer not null default 0,
  actif          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_types_projet_updated_at on public.types_projet;
create trigger trg_types_projet_updated_at before update on public.types_projet
  for each row execute function public.tg_set_updated_at();

alter table public.types_projet enable row level security;
drop policy if exists "types_projet_select" on public.types_projet;
create policy "types_projet_select" on public.types_projet for select
  using (auth.role() = 'authenticated');
drop policy if exists "types_projet_write" on public.types_projet;
create policy "types_projet_write" on public.types_projet for all
  using (public.my_role() = 'super_admin')
  with check (public.my_role() = 'super_admin');

insert into public.types_projet (code, libelle, accroche, exemples, couleur, icone, jalons_modele, blocs_actifs, legacy_type, ordre)
values
(
  'investissement', 'Investissement structurant',
  'Travaux, achats et aménagements financés en section d''investissement.',
  array['Réhabilitation des halles', 'Réfection du clocher', 'Aménagement de voirie', 'Achat d''un bâtiment'],
  '#042F64', 'HardHat',
  '[
    {"libelle": "Estimation du coût du projet"},
    {"libelle": "Délibération de principe du conseil municipal"},
    {"libelle": "Demande(s) de subvention déposée(s)"},
    {"libelle": "Accusé de réception des demandes de subvention", "verrou": "accuse_reception"},
    {"libelle": "Consultation des entreprises / demande de devis"},
    {"libelle": "Choix de l''entreprise et signature"},
    {"libelle": "Démarrage des travaux", "verrou": "commencement_execution"},
    {"libelle": "Réception des travaux"},
    {"libelle": "Solde des subventions"}
  ]'::jsonb,
  '["etapes", "budget", "devis", "financeurs", "documents"]'::jsonb,
  'investment', 1
),
(
  'evenementiel', 'Événement',
  'Manifestations et cérémonies, budget de fonctionnement, planning à rebours.',
  array['Fête communale', 'Repas des aînés', 'Inauguration', 'Cérémonie du 11 novembre'],
  '#B0306A', 'PartyPopper',
  '[
    {"libelle": "Validation du principe et du budget", "offset_jours": -90},
    {"libelle": "Réservation du lieu et du matériel", "offset_jours": -60},
    {"libelle": "Demande de prêt de matériel (intercommunalité, Département)", "offset_jours": -60},
    {"libelle": "Arrêté municipal (circulation, stationnement, occupation du domaine public)", "offset_jours": -30},
    {"libelle": "Déclaration de débit de boissons temporaire", "offset_jours": -30, "conditionnel": true,
     "aide": "À cocher si vous prévoyez une buvette. Une déclaration en mairie est nécessaire."},
    {"libelle": "Déclaration SACEM", "offset_jours": -21, "conditionnel": true,
     "aide": "À cocher si de la musique est diffusée (concert, sono, DJ)."},
    {"libelle": "Vérification de la couverture d''assurance", "offset_jours": -21},
    {"libelle": "Communication (bulletin, site, réseaux, affichage)", "offset_jours": -21},
    {"libelle": "Organisation des bénévoles et du planning", "offset_jours": -14},
    {"libelle": "Point logistique final", "offset_jours": -3},
    {"libelle": "Bilan et remerciements", "offset_jours": 7}
  ]'::jsonb,
  '["retroplanning", "budget_fonctionnement", "partenaires", "documents"]'::jsonb,
  'event', 2
),
(
  'suivi_simple', 'Suivi simple',
  'Un dossier à suivre, des devis éventuels, sans montage financier.',
  array['Problème d''eaux pluviales', 'Remplacement de jeux', 'Petit dossier en cours'],
  '#4A5068', 'ListChecks',
  '[]'::jsonb,
  '["etapes"]'::jsonb,
  'tracking', 3
)
on conflict (code) do nothing;

-- ─── projects.type_code ───
alter table public.projects add column if not exists type_code text;
-- date_maj préservée pendant la reprise
alter table public.projects disable trigger trg_projects_date_maj;
update public.projects p
   set type_code = t.code
  from public.types_projet t
 where t.legacy_type = p.type and p.type_code is distinct from t.code;
alter table public.projects enable trigger trg_projects_date_maj;
alter table public.projects alter column type_code set not null;
do $$ begin
  alter table public.projects add constraint projects_type_code_fkey
    foreign key (type_code) references public.types_projet(code) on update cascade on delete restrict;
exception when duplicate_object then null; end $$;
create index if not exists idx_projects_type_code on public.projects (commune_id, type_code) where deleted_at is null;

-- Synchronisation type (enum legacy) ↔ type_code pendant la transition.
create or replace function public.projects_sync_type_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.type_code is null then
      select code into new.type_code from public.types_projet where legacy_type = new.type;
    else
      select coalesce(legacy_type, new.type) into new.type from public.types_projet where code = new.type_code;
    end if;
  elsif new.type_code is distinct from old.type_code then
    select coalesce(legacy_type, new.type) into new.type from public.types_projet where code = new.type_code;
  elsif new.type is distinct from old.type then
    select code into new.type_code from public.types_projet where legacy_type = new.type;
  end if;
  return new;
end
$$;

drop trigger if exists trg_projects_sync_type_code on public.projects;
create trigger trg_projects_sync_type_code before insert or update of type, type_code on public.projects
  for each row execute function public.projects_sync_type_code();

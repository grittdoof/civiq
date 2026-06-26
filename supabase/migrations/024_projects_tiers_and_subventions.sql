-- ═══════════════════════════════════════════════════════════════
-- Migration 024 — Projets « tiers » + suivi détaillé des subventions
-- ═══════════════════════════════════════════════════════════════
--
-- 1. Ajoute les champs « tiers » sur projects (la commune accompagne
--    un porteur externe sans nécessairement le financer).
-- 2. Étend financings avec les colonnes nécessaires au suivi
--    d'éligibilité demandé par le maire (définition du commencement
--    d'exécution, dates notification marchés, ordre de service,
--    taux/plafond/échéance dépôt, statut éligibilité).
--
-- Idempotente : peut être rejouée sans casser l'état existant.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Enums « tiers » et « éligibilité » ──────────────────────
do $$ begin
  create type public.project_tiers_type as enum (
    'entreprise',
    'association',
    'particulier',
    'autre_collectivite',
    'autre'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financing_eligibility as enum (
    'a_evaluer',
    'preservee',
    'vigilance',
    'compromise'
  );
exception when duplicate_object then null; end $$;

-- ─── 2. Champs « tiers » sur projects ───────────────────────────
alter table public.projects
  add column if not exists concerne_tiers boolean not null default false,
  add column if not exists tiers_nom text,
  add column if not exists tiers_type public.project_tiers_type,
  add column if not exists tiers_contact text,
  add column if not exists accompagne_sans_financer boolean not null default false;

comment on column public.projects.concerne_tiers is
  'Le projet concerne un porteur externe (entreprise, asso, particulier…) que la commune accompagne.';
comment on column public.projects.accompagne_sans_financer is
  'La commune accompagne (instruction, conseil, mise en relation) sans contribuer financièrement.';

-- ─── 3. Colonnes suivi subventions sur financings ───────────────
alter table public.financings
  -- Règle métier du dispositif : ce qui constitue commencement
  -- d'exécution (déclencheur d'irrégularité si engagé avant AR).
  add column if not exists definition_commencement text,
  -- Dates qui font basculer l'éligibilité
  add column if not exists date_notification_marche date,
  add column if not exists date_ordre_service date,
  -- Statut calculé/saisi
  add column if not exists eligibilite public.financing_eligibility
    not null default 'a_evaluer',
  add column if not exists eligibilite_note text,
  -- Paramètres du dispositif
  add column if not exists taux numeric(5,2),
  add column if not exists plafond numeric(14,2),
  add column if not exists deadline_depot date,
  -- Catégorisation libre (DETR/DSIL, FCTVA, mécénat…)
  add column if not exists dispositif text;

comment on column public.financings.definition_commencement is
  'Définition du commencement d''exécution retenue par le règlement du dispositif (texte libre).';
comment on column public.financings.eligibilite is
  'Statut d''éligibilité au regard du calendrier : préservée / vigilance / compromise.';
comment on column public.financings.deadline_depot is
  'Échéance de dépôt propre au dispositif (date butoir).';

-- ─── 4. Index pour les requêtes d'alerte ────────────────────────
create index if not exists idx_financings_eligibilite
  on public.financings(project_id, eligibilite);
create index if not exists idx_financings_deadline
  on public.financings(project_id, deadline_depot)
  where deadline_depot is not null;

-- ─── 5. Fonction utilitaire : calcule l'éligibilité ─────────────
-- Règle simple :
--   - Si notification marché OU OS antérieur à l'AR (date_ar) → compromise
--   - Si notification marché < AR mais pas encore d'AR (date_ar null)
--     et le marché est déjà notifié → vigilance
--   - Sinon préservée si AR reçu, à_évaluer si non déposée
create or replace function public.financing_compute_eligibility(
  p_date_demande date,
  p_date_ar date,
  p_date_notification_marche date,
  p_date_ordre_service date
) returns public.financing_eligibility
language plpgsql immutable as $$
declare
  v_start date;
begin
  v_start := least(p_date_notification_marche, p_date_ordre_service);

  -- Pas encore de demande déposée
  if p_date_demande is null and p_date_ar is null then
    if v_start is not null then
      -- Marché déjà notifié alors qu'aucune demande n'est partie : compromise
      return 'compromise';
    end if;
    return 'a_evaluer';
  end if;

  -- Demande déposée mais pas encore d'AR
  if p_date_ar is null then
    if v_start is not null and v_start < coalesce(p_date_demande, current_date) then
      return 'compromise';
    end if;
    if v_start is not null then
      return 'vigilance';
    end if;
    return 'preservee';
  end if;

  -- AR reçu : on vérifie que le commencement n'a pas précédé l'AR
  if v_start is not null and v_start < p_date_ar then
    return 'compromise';
  end if;

  return 'preservee';
end $$;

-- ─── 6. Notification de mise à jour automatique ─────────────────
-- Ré-utilise le trigger existant qui met à jour `updated_at`.
-- Pas de nouveau trigger nécessaire.

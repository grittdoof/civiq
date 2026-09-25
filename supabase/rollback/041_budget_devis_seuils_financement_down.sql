-- Retour arrière de 041. Les montants saisis restent dans montant_prevu /
-- montant_reel (budget) et montant_ht / montant_ttc (devis).

-- Verrou
drop trigger if exists trg_milestones_zz_commencement on public.milestones;
drop function if exists public.milestones_check_commencement();
alter table public.milestones drop constraint if exists milestones_verrou_check;
alter table public.milestones drop column if exists verrou;

-- create_project_from_wizard : rejouer la version de 040
-- (supabase/migrations/040_parcours_creation.sql, section 4).

-- Plan de financement
drop function if exists public.project_financement(uuid);
alter table public.financings drop column if exists assiette_ht, drop column if exists contact_id;
alter table public.projects
  drop constraint if exists projects_categorie_achat_check,
  drop constraint if exists projects_financement_positif_check;
alter table public.projects
  drop column if exists emprunt_prevu,
  drop column if exists autofinancement_invest,
  drop column if exists autofinancement_fonct,
  drop column if exists autofinancement_assume,
  drop column if exists autofinancement_assume_par,
  drop column if exists autofinancement_assume_le,
  drop column if exists date_consultation,
  drop column if exists categorie_achat;

-- Devis
drop index if exists public.uq_quotes_retenu_par_lot;
drop index if exists public.idx_quotes_contact;
drop trigger if exists trg_quotes_ttc on public.project_quotes;
drop function if exists public.quotes_compute_ttc();
alter table public.project_quotes drop constraint if exists quotes_ht_required, drop constraint if exists quotes_tva_check;
alter table public.project_quotes
  drop column if exists taux_tva, drop column if exists contact_id, drop column if exists lot,
  drop column if exists date_reception, drop column if exists validite, drop column if exists created_by;
update public.project_quotes q set phase = p.phase from public.projects p where p.id = q.project_id and q.phase is null;
alter table public.project_quotes alter column phase set not null;

-- Budget
alter table public.project_budget_lines
  drop column if exists montant_prevu_ht, drop column if exists montant_prevu_ttc,
  drop column if exists montant_reel_ht, drop column if exists montant_reel_ttc;
alter table public.project_budget_lines
  drop constraint if exists budget_base_check, drop constraint if exists budget_etat_check,
  drop constraint if exists budget_section_check, drop constraint if exists budget_tva_check,
  drop constraint if exists budget_montants_check;
update public.project_budget_lines set categorie = 'autre' where categorie in ('participation', 'travaux', 'etudes', 'acquisition');
alter table public.project_budget_lines drop constraint if exists project_budget_lines_categorie_check;
alter table public.project_budget_lines add constraint project_budget_lines_categorie_check
  check (categorie is null or categorie in ('buvette', 'billetterie', 'mecenat', 'subvention', 'prestataire',
                                            'materiel', 'location', 'personnel', 'communication', 'autre'));
alter table public.project_budget_lines
  drop column if exists base, drop column if exists taux_tva, drop column if exists etat,
  drop column if exists section, drop column if exists chapitre_m57, drop column if exists operation,
  drop column if exists created_by;

-- Seuils
drop function if exists public.seuil_applicable(text, text, date);
drop table if exists public.seuils_commande_publique;

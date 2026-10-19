// ═══════════════════════════════════════════════════════════════
// Types du module Gestion de projet
// Reflètent les enums + tables de supabase/migrations/017_*.sql
// ═══════════════════════════════════════════════════════════════

export type ProjectPhase =
  // Gabarit investment (7 phases — historique)
  | "emergence"
  | "faisabilite"
  | "decision_budget"
  | "financement"
  | "conception_marches"
  | "realisation"
  | "bilan_cloture"
  // Gabarit event (5 phases)
  | "event_framing"
  | "event_authorizations"
  | "event_logistics"
  | "event_dday"
  | "event_review"
  // Gabarit tracking (3 phases)
  | "tracking_framing"
  | "tracking_execution"
  | "tracking_review";

export type ProjectType = "investment" | "event" | "tracking";

export type ProjectCompetence = "communale" | "intercommunale" | "a_verifier";

export type StakeholderType =
  | "interne"
  | "institutionnelle"
  | "financeur"
  | "technique"
  | "citoyenne";

export type StakeholderRole = "decide" | "finance" | "execute" | "consulte" | "informe";

export type FinancingStatus =
  | "a_demander"
  | "demandee"
  | "ar_recu"
  | "accordee"
  | "refusee"
  | "soldee";

export type CommissionMemberRole = "president" | "vice_president" | "membre";
export type CommissionSessionStatut = "planifiee" | "tenue" | "annulee";
export type SessionDecisionType =
  | "decision"
  | "avis_favorable"
  | "avis_defavorable"
  | "action";

export type ProjectDocumentType =
  | "fiche_projet"
  | "deliberation"
  | "devis"
  | "plan_financement"
  | "autre";

// ── Ordre canonique des phases par gabarit ──
export const PROJECT_PHASES_BY_TYPE: Record<ProjectType, ProjectPhase[]> = {
  investment: [
    "emergence",
    "faisabilite",
    "decision_budget",
    "financement",
    "conception_marches",
    "realisation",
    "bilan_cloture",
  ],
  event: [
    "event_framing",
    "event_authorizations",
    "event_logistics",
    "event_dday",
    "event_review",
  ],
  tracking: [
    "tracking_framing",
    "tracking_execution",
    "tracking_review",
  ],
};

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  // investment
  emergence: "Émergence",
  faisabilite: "Faisabilité & cadrage",
  decision_budget: "Décision & budget",
  financement: "Recherche de financement",
  conception_marches: "Conception & marchés",
  realisation: "Réalisation",
  bilan_cloture: "Bilan & clôture",
  // event
  event_framing: "Cadrage",
  event_authorizations: "Autorisations & sécurité",
  event_logistics: "Logistique & budget",
  event_dday: "Jour J",
  event_review: "Bilan",
  // tracking
  tracking_framing: "Cadrage",
  tracking_execution: "Mise en œuvre",
  tracking_review: "Suivi & bilan",
};

export const PROJECT_PHASE_HINTS: Record<ProjectPhase, string> = {
  // investment
  emergence: "Fiche d'opportunité, premières études d'idée",
  faisabilite: "Étude de faisabilité, scénarios, pré-chiffrage",
  decision_budget: "PPI, délibération de principe, vote du budget",
  financement: "Demandes de subventions, plan de financement",
  conception_marches: "Maîtrise d'œuvre, marchés publics",
  realisation: "Travaux et livraisons",
  bilan_cloture: "Bilan financier et clôture administrative",
  // event
  event_framing: "Concept, date, public, enveloppe",
  event_authorizations: "Arrêtés, déclarations, sécurité, assurance",
  event_logistics: "Réservations, devis, budget, com, bénévoles",
  event_dday: "Montage, déroulé, démontage",
  event_review: "Bilan financier, fréquentation, reconduction",
  // tracking
  tracking_framing: "Objectif, pilote, commission",
  tracking_execution: "Jalons, actions, pièces",
  tracking_review: "Point d'étape, ajustements, clôture ou reconduction",
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  investment: "Investissement structurant",
  event: "Événementiel",
  tracking: "Suivi simple / démarche",
};

export const FINANCING_STATUS_LABELS: Record<FinancingStatus, string> = {
  a_demander: "À demander",
  demandee: "Demandée",
  ar_recu: "Accusé de réception reçu",
  accordee: "Accordée",
  refusee: "Refusée",
  soldee: "Soldée",
};

export const STAKEHOLDER_ROLE_LABELS: Record<StakeholderRole, string> = {
  decide: "Décide",
  finance: "Finance",
  execute: "Exécute",
  consulte: "Consulté",
  informe: "Informé",
};

export const STAKEHOLDER_TYPE_LABELS: Record<StakeholderType, string> = {
  interne: "Service interne",
  institutionnelle: "Institutionnelle",
  financeur: "Financeur",
  technique: "Bureau d'études / technique",
  citoyenne: "Citoyenne / associative",
};

// ── Statuts de subvention considérés comme « sécurisée » par la porte
//    de financement (le projet peut entrer en réalisation). ──
export const SECURED_FINANCING_STATUSES: FinancingStatus[] = [
  "ar_recu",
  "accordee",
  "soldee",
];

// ─── Interfaces tables ───
/** @deprecated Utiliser CommuneParametres (lib/projects/commune-parametres). */
export type { CommuneParametres as CommuneSettings } from "./commune-parametres";

export type ProjectTiersType =
  | "entreprise"
  | "association"
  | "particulier"
  | "autre_collectivite"
  | "autre";

export const PROJECT_TIERS_TYPE_LABELS: Record<ProjectTiersType, string> = {
  entreprise: "Entreprise",
  association: "Association",
  particulier: "Particulier",
  autre_collectivite: "Autre collectivité",
  autre: "Autre",
};

export interface Project {
  id: string;
  commune_id: string;
  titre: string;
  description: string | null;
  objectifs: string | null;
  competence: ProjectCompetence;
  /** Gabarit du projet (migration 028). Default 'investment' pour le legacy. */
  type: ProjectType;
  phase: ProjectPhase;
  pilote_elu: string | null;
  pilote_agent: string | null;
  budget_estime: number;
  sans_subvention: boolean;
  source_ticket_id: string | null;
  taux_inflation: number | null;
  taux_actualisation: number | null;
  cout_reel: number | null;
  ecart: number | null;
  explication_ecart: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  // Projet « tiers » : la commune accompagne un porteur externe
  concerne_tiers: boolean;
  tiers_nom: string | null;
  tiers_type: ProjectTiersType | null;
  tiers_contact: string | null;
  accompagne_sans_financer: boolean;
  /** Inclus dans le Plan Pluriannuel d'Investissement. Default = true. */
  in_ppi: boolean;
  /**
   * Progression des livrables-type par phase.
   * Format : { phase: { index: { done: bool, note: string|null, applicable?: bool } } }
   * `applicable` (default true) permet de marquer un livrable « non applicable ».
   * Les livrables non applicables sortent du calcul de progression obligatoire.
   */
  phase_progress: Record<
    string,
    Record<string, { done: boolean; note: string | null; applicable?: boolean }>
  >;
  /**
   * Phases marquées « non applicable » pour ce projet (migration 028).
   * Format : { phase_key: motif_text }. Une phase NA sort du calcul de
   * progression et sa traversée n'est pas considérée comme un saut.
   */
  phase_not_applicable: Record<string, string>;
  date_creation: string;
  date_maj: string;
  created_by: string | null;
  // ─── Lot A (migrations 036-038) ───
  /** Référentiel types_projet : investissement | evenementiel | suivi_simple */
  type_code?: TypeProjetCode;
  /** Suppression logique (jamais de DELETE physique). */
  deleted_at?: string | null;
  /** Archivé : consultable, exclu des listes actives. */
  archived_at?: string | null;
  archive_motif?: string | null;
  /** Clôture du dossier (migration 050) : hors des projets ouverts, lecture seule. */
  clos_at?: string | null;
  clos_par?: string | null;
  clos_bilan?: string | null;
  /** Jalons terminés / jalons, en %. null = « non renseigné » (aucun jalon). */
  avancement_pct?: number | null;
  avancement_manuel_pct?: number | null;
  avancement_manuel_motif?: string | null;
  avancement_manuel_par?: string | null;
  avancement_manuel_le?: string | null;
}

export type TypeProjetCode = "investissement" | "evenementiel" | "suivi_simple";

export type EtapeStatut = "a_faire" | "en_cours" | "termine";

export interface ProjectPhaseLog {
  id: string;
  project_id: string;
  from_phase: ProjectPhase | null;
  to_phase: ProjectPhase;
  user_id: string | null;
  commentaire: string | null;
  forced: boolean;
  created_at: string;
}

export interface ProjectSubscriber {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
}

export interface Stakeholder {
  id: string;
  commune_id: string;
  nom: string;
  organisation: string | null;
  email: string | null;
  telephone: string | null;
  /** Catégorie de partie prenante (contacts.categorie). */
  type: StakeholderType;
  /** Nature du contact (contacts.type) : personne, entreprise, association… */
  nature?: "personne" | "entreprise" | "collectivite" | "financeur" | "association";
  created_at: string;
}

export interface ProjectStakeholder {
  id: string;
  project_id: string;
  stakeholder_id: string;
  role: StakeholderRole;
  phase: ProjectPhase | null;
  created_at: string;
}

export type FinancingEligibility =
  | "a_evaluer"
  | "preservee"
  | "vigilance"
  | "compromise";

export interface Financing {
  id: string;
  project_id: string;
  financeur: string;
  dispositif: string | null;
  montant_demande: number | null;
  montant_obtenu: number | null;
  statut: FinancingStatus;
  date_demande: string | null;
  date_ar: string | null;
  date_decision: string | null;
  // Suivi détaillé éligibilité
  definition_commencement: string | null;
  date_notification_marche: string | null;
  date_ordre_service: string | null;
  eligibilite: FinancingEligibility;
  eligibilite_note: string | null;
  taux: number | null;
  plafond: number | null;
  deadline_depot: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Étape d'un projet (table milestones, étendue par la migration 038). */
export interface Milestone {
  id: string;
  project_id: string;
  /** Facultative depuis la migration 038 (les étapes ne dépendent plus des phases). */
  phase: ProjectPhase | null;
  libelle: string;
  /** Legacy : date seule, synchronisée avec date_previsionnelle par trigger. */
  echeance: string | null;
  /** Legacy : synchronisé avec statut === "termine" par trigger. */
  fait: boolean;
  responsable_user_id: string | null;
  created_at: string;
  updated_at: string;
  statut?: EtapeStatut;
  date_previsionnelle?: string | null;
  date_reelle?: string | null;
  est_un_jalon?: boolean;
  remonter_au_reporting?: boolean;
  commentaire?: string | null;
  commentaire_note_interne?: boolean;
  ordre?: number | null;
  deleted_at?: string | null;
}

export interface ProjectLifecycleCost {
  id: string;
  project_id: string;
  annee: number;            // 1..10
  cout_fonctionnement: number;
  cout_entretien: number;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  type: ProjectDocumentType;
  nom: string;
  url: string;
  storage_path: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  /** Étape à laquelle la pièce est jointe (lot B). */
  milestone_id?: string | null;
  /** Note interne : exclue de la fiche communicable (CADA). */
  note_interne?: boolean;
}

export interface Commission {
  id: string;
  commune_id: string;
  nom: string;
  description: string | null;
  responsable_user_id: string | null;
  active: boolean;
  /** Couleur HEX #RRGGBB pour identifier visuellement la commission */
  color: string;
  /** Identifiant Lucide (cf. CommissionIcon) */
  icon: string;
  /** Commission parente (pour les sous-commissions) */
  parent_id: string | null;
  created_at: string;
}

/** Palette de couleurs proposée par défaut pour les commissions */
export const COMMISSION_COLOR_PALETTE = [
  "#5A8DEE", // bleu (défaut)
  "#FF5A5F", // coral
  "#2BB673", // vert
  "#F39C12", // ambre
  "#9B59B6", // violet
  "#1ABC9C", // turquoise
  "#E74C3C", // rouge
  "#34495E", // bleu nuit
];

/** Liste blanche des icônes Lucide proposées pour une commission */
export const COMMISSION_ICONS = [
  "Gavel", "Wallet", "HardHat", "Building2", "MapPin",
  "Trees", "GraduationCap", "Heart", "Users", "ShieldCheck",
  "Lightbulb", "Calendar", "Briefcase", "Landmark",
] as const;
export type CommissionIconName = typeof COMMISSION_ICONS[number];

export interface CommissionMember {
  id: string;
  commission_id: string;
  /** Null si membre externe (sans compte GoCiviq) */
  user_id: string | null;
  role: CommissionMemberRole;
  /** Nom du membre externe (si user_id est null) */
  external_name: string | null;
  external_email: string | null;
  external_phone: string | null;
  created_at: string;
  /** Titulaire (défaut) ou suppléant (migration 051). */
  statut_membre?: "titulaire" | "suppleant";
}

export interface CommissionSession {
  id: string;
  commission_id: string;
  date_seance: string;
  lieu: string | null;
  ordre_du_jour: string | null;
  statut: CommissionSessionStatut;
  secretaire_de_seance_user_id: string | null;
  compte_rendu: string | null;
  compte_rendu_valide: boolean;
  compte_rendu_valide_at: string | null;
  compte_rendu_valide_by: string | null;
  compte_rendu_pdf_url: string | null;
  /** PDF scanné de la feuille d'émargement signée à la main */
  signed_attendance_pdf_url: string | null;
  signed_attendance_pdf_path: string | null;
  signed_attendance_uploaded_by: string | null;
  signed_attendance_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionAttendance {
  id: string;
  session_id: string;
  /** Null pour un membre externe */
  conseiller_user_id: string | null;
  /** Rattachement à commission_members (pour les externes) */
  commission_member_id: string | null;
  present: boolean | null;
  /** Présent / excusé / absent (null = non renseigné) — migration 046. */
  statut?: "present" | "excuse" | "absent" | null;
  signature_data: string | null;
  signe_le: string | null;
  created_at: string;
}

export interface SessionDecision {
  id: string;
  session_id: string;
  project_id: string | null;
  libelle: string;
  type: SessionDecisionType;
  responsable_user_id: string | null;
  echeance: string | null;
  created_at: string;
}

// ─── Résultats RPC / queries enrichies ───

export interface ProjectGlobalCost {
  invest: number;
  total_nominal: number;
  total_actualise: number;
  taux_inflation_used: number;
  taux_actualisation_used: number;
}

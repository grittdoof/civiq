// ═══════════════════════════════════════════════════════════════
// Types du module Gestion de projet
// Reflètent les enums + tables de supabase/migrations/017_*.sql
// ═══════════════════════════════════════════════════════════════

export type ProjectPhase =
  | "emergence"
  | "faisabilite"
  | "decision_budget"
  | "financement"
  | "conception_marches"
  | "realisation"
  | "bilan_cloture";

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

export type CommissionMemberRole = "president" | "membre";
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

// ── Ordre canonique des phases (utilisé par la state-machine) ──
export const PROJECT_PHASES: ProjectPhase[] = [
  "emergence",
  "faisabilite",
  "decision_budget",
  "financement",
  "conception_marches",
  "realisation",
  "bilan_cloture",
];

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  emergence: "Émergence",
  faisabilite: "Faisabilité & cadrage",
  decision_budget: "Décision & budget",
  financement: "Recherche de financement",
  conception_marches: "Conception & marchés",
  realisation: "Réalisation",
  bilan_cloture: "Bilan & clôture",
};

export const PROJECT_PHASE_HINTS: Record<ProjectPhase, string> = {
  emergence: "Fiche d'opportunité, premières études d'idée",
  faisabilite: "Étude de faisabilité, scénarios, pré-chiffrage",
  decision_budget: "PPI, délibération de principe, vote du budget",
  financement: "Demandes de subventions, plan de financement",
  conception_marches: "Maîtrise d'œuvre, marchés publics",
  realisation: "Travaux et livraisons",
  bilan_cloture: "Bilan financier et clôture administrative",
};

/** @deprecated Conservé pour rétrocompatibilité PDF (texte) — préférer
 *  PROJECT_PHASE_LUCIDE pour l'UI React. */
export const PROJECT_PHASE_ICONS: Record<ProjectPhase, string> = {
  emergence: "•",
  faisabilite: "•",
  decision_budget: "•",
  financement: "•",
  conception_marches: "•",
  realisation: "•",
  bilan_cloture: "•",
};

/** Identifiants symboliques pour résoudre vers une icône Lucide
 *  côté composants UI (cf. src/components/projects/PhaseIcon.tsx).
 *  Choix d'icônes fines et neutres, pas d'emoji. */
export const PROJECT_PHASE_LUCIDE: Record<ProjectPhase, string> = {
  emergence: "Lightbulb",
  faisabilite: "Search",
  decision_budget: "Landmark",
  financement: "Wallet",
  conception_marches: "Ruler",
  realisation: "HardHat",
  bilan_cloture: "Flag",
};

export const PROJECT_PHASE_SHORT: Record<ProjectPhase, string> = {
  emergence: "Émergence",
  faisabilite: "Faisabilité",
  decision_budget: "Décision",
  financement: "Financement",
  conception_marches: "Conception",
  realisation: "Travaux",
  bilan_cloture: "Clôture",
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
export interface CommuneSettings {
  commune_id: string;
  taux_inflation: number;
  taux_actualisation: number;
  updated_at: string;
}

export interface Project {
  id: string;
  commune_id: string;
  titre: string;
  description: string | null;
  objectifs: string | null;
  competence: ProjectCompetence;
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
  date_creation: string;
  date_maj: string;
  created_by: string | null;
}

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
  type: StakeholderType;
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

export interface Financing {
  id: string;
  project_id: string;
  financeur: string;
  montant_demande: number | null;
  montant_obtenu: number | null;
  statut: FinancingStatus;
  date_demande: string | null;
  date_ar: string | null;
  date_decision: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  phase: ProjectPhase;
  libelle: string;
  echeance: string | null;
  fait: boolean;
  responsable_user_id: string | null;
  created_at: string;
  updated_at: string;
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
}

export interface CommissionProject {
  id: string;
  commission_id: string;
  project_id: string;
  created_at: string;
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

export interface AdvanceResult {
  ok: boolean;
  reason?: string;
  warnings?: string[];
  direction?: "forward" | "backward";
  require_force?: boolean;
  require_comment?: boolean;
  from_phase?: ProjectPhase;
  to_phase?: ProjectPhase;
}

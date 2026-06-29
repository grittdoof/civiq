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

export type CommissionMemberRole = "president" | "vice_president" | "membre";

export const COMMISSION_MEMBER_ROLE_LABELS: Record<CommissionMemberRole, string> = {
  president: "Président·e",
  vice_president: "Vice-président·e",
  membre: "Membre",
};
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

// ─── Guide narratif par phase ───
// Donne du sens à chaque étape : objectif principal, livrables types
// attendus, condition de passage à la phase suivante. Affiché dans
// le panneau PhaseGuide juste sous le stepper.

// ─── Livrables actionnables typés ───
// Chaque livrable d'une phase est lié à une ressource concrète de
// la fiche projet. Certains types s'auto-cochent dès qu'au moins
// une ressource correspondante existe (ex : ≥ 1 document attaché).
// Les types « task » et « field » restent gérés via phase_progress.

export type DeliverableKind =
  | "task"          // tâche libre — coche manuelle + note
  | "document"      // auto-coche si ≥ 1 document attaché au projet
  | "stakeholder"   // auto-coche si ≥ 1 partie prenante
  | "financing"     // auto-coche si ≥ 1 ligne de financement
  | "milestone"     // auto-coche si ≥ 1 jalon
  | "field"         // champ(s) à remplir sur le projet (cf. fields)
  | "identity";     // titre + description + objectifs + photo (Émergence)

export type DeliverableLink =
  | "documents"
  | "stakeholders"
  | "financings"
  | "milestones"
  | "objectifs"
  | "lifecycle"
  | "bilan"
  | "commissions";

export interface DeliverableSpec {
  /** Libellé court visible à l'utilisateur. */
  label: string;
  /** Type → détermine l'UI et l'auto-détection. */
  kind: DeliverableKind;
  /** Section cible vers laquelle pointe le bouton « Compléter ». */
  link?: DeliverableLink;
}

export interface PhaseGuideEntry {
  /** Phrase qui répond à « C'est quoi cette étape ? » */
  objective: string;
  /** Livrables-type attendus (chacun typé). */
  deliverables: DeliverableSpec[];
  /** Critère pour basculer dans la phase suivante (porte). */
  gate: string;
  /** Ce qu'on a généralement DÉJÀ fait en arrivant ici (rassurant). */
  arrivedWith: string;
}

export const PROJECT_PHASE_GUIDE: Record<ProjectPhase, PhaseGuideEntry> = {
  emergence: {
    arrivedWith: "Une idée, un besoin du terrain, un signalement.",
    objective:
      "Caractériser l'opportunité pour décider si elle mérite d'être étudiée. C'est l'étape la moins coûteuse — le rôle ici est de cadrer et trier.",
    deliverables: [
      { label: "Identité du projet : titre, description, objectifs, photo.", kind: "identity" },
      { label: "Fiche d'opportunité (1 page) : enjeu, public visé, ordre de grandeur du budget.", kind: "document", link: "documents" },
      { label: "Désignation d'un pilote élu et d'un pilote agent.", kind: "field", link: "objectifs" },
      { label: "Avis informel des parties prenantes clés.", kind: "stakeholder", link: "stakeholders" },
    ],
    gate:
      "Le projet est jugé suffisamment pertinent pour engager une étude de faisabilité.",
  },
  faisabilite: {
    arrivedWith: "Une fiche d'opportunité validée et des pilotes désignés.",
    objective:
      "Vérifier que le projet est techniquement faisable, juridiquement compétent et économiquement soutenable. C'est l'étape qui transforme une idée en programme.",
    deliverables: [
      { label: "Étude de faisabilité (technique, juridique, financière).", kind: "document", link: "documents" },
      { label: "Plusieurs scénarios chiffrés avec leurs coûts globaux sur 10 ans.", kind: "field", link: "lifecycle" },
      { label: "Pré-identification des financeurs potentiels.", kind: "financing", link: "financings" },
      { label: "Compétence confirmée (communale / intercommunale / partagée).", kind: "task" },
    ],
    gate:
      "Un scénario est sélectionné par les élus et est prêt à être délibéré.",
  },
  decision_budget: {
    arrivedWith: "Un scénario chiffré et un coût global sur 10 ans documenté.",
    objective:
      "Engager la commune politiquement et budgétairement. Une fois le budget voté, le projet est officiel et son périmètre est verrouillé.",
    deliverables: [
      { label: "Délibération de principe au Conseil municipal.", kind: "document", link: "documents" },
      { label: "Inscription du projet au PPI (Plan Pluriannuel d'Investissement).", kind: "task" },
      { label: "Autorisation de programme et crédits de paiement votés.", kind: "milestone", link: "milestones" },
      { label: "Information publique du lancement.", kind: "task" },
    ],
    gate:
      "Le budget est voté et les crédits sont disponibles pour engager la suite.",
  },
  financement: {
    arrivedWith: "Un budget voté et des financeurs identifiés.",
    objective:
      "Sécuriser le tour de table financier AVANT d'engager juridiquement les marchés. Toute notification de marché avant l'AR du dossier compromet l'éligibilité.",
    deliverables: [
      { label: "Dépôt des dossiers de subvention (DETR, DSIL, Département, Région…).", kind: "financing", link: "financings" },
      { label: "Accusés de réception (AR) des dossiers complets.", kind: "task" },
      { label: "Notifications d'attribution ou de refus.", kind: "task" },
      { label: "Plan de financement consolidé et validé.", kind: "financing", link: "financings" },
    ],
    gate:
      "Porte de financement : autofinancement assumé OU au moins 1 subvention notifiée. Aucun marché ne doit être notifié tant que l'AR n'est pas reçu.",
  },
  conception_marches: {
    arrivedWith: "Un financement sécurisé et la porte de financement franchie.",
    objective:
      "Designer le projet (maîtrise d'œuvre) et passer les marchés de travaux dans le respect de la commande publique.",
    deliverables: [
      { label: "Désignation du maître d'œuvre.", kind: "stakeholder", link: "stakeholders" },
      { label: "APS, APD, PRO (avant-projet sommaire, définitif, projet).", kind: "document", link: "documents" },
      { label: "Publication des marchés de travaux (BOAMP/JOUE).", kind: "milestone", link: "milestones" },
      { label: "Analyse des offres et attribution.", kind: "document", link: "documents" },
    ],
    gate:
      "Les marchés de travaux sont notifiés et l'ordre de service peut être donné.",
  },
  realisation: {
    arrivedWith:
      "Marchés notifiés. L'éligibilité subventions est ici la plus exposée — vérifier les antériorités.",
    objective:
      "Piloter le chantier jusqu'à la réception. L'objectif est de tenir le triptyque coût / délai / qualité tout en gardant trace pour le bilan.",
    deliverables: [
      { label: "Ordre de service de démarrage.", kind: "milestone", link: "milestones" },
      { label: "Comptes-rendus de chantier réguliers.", kind: "document", link: "documents" },
      { label: "Avenants éventuels approuvés.", kind: "document", link: "documents" },
      { label: "PV de réception et levée des réserves.", kind: "document", link: "documents" },
    ],
    gate:
      "Les travaux sont réceptionnés et la garantie de parfait achèvement court.",
  },
  bilan_cloture: {
    arrivedWith: "Un ouvrage réceptionné et toutes les factures soldées.",
    objective:
      "Tirer les enseignements du projet : coût réel vs prévu, retours d'usage, transmission aux futures équipes. C'est l'étape la plus oubliée et la plus utile pour la suite.",
    deliverables: [
      { label: "Coût réel saisi et écart vs budget initial expliqué.", kind: "field", link: "bilan" },
      { label: "Bilan d'utilisation (premiers mois d'exploitation).", kind: "document", link: "documents" },
      { label: "Archivage des pièces administratives.", kind: "document", link: "documents" },
      { label: "Réintégration des données de coût d'exploitation au PPI futur.", kind: "task" },
    ],
    gate:
      "Le bilan est validé et le projet peut être archivé sereinement.",
  },
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
   * Format : { phase: { index: { done: bool, note: string|null } } }
   */
  phase_progress: Record<string, Record<string, { done: boolean; note: string | null }>>;
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

export type FinancingEligibility =
  | "a_evaluer"
  | "preservee"
  | "vigilance"
  | "compromise";

export const FINANCING_ELIGIBILITY_LABELS: Record<FinancingEligibility, string> = {
  a_evaluer: "À évaluer",
  preservee: "Éligibilité préservée",
  vigilance: "Point de vigilance",
  compromise: "Éligibilité compromise",
};

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

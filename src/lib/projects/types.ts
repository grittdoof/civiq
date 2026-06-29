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

/** @deprecated — ne couvre que le gabarit investment.
 *  Utiliser PROJECT_PHASES_BY_TYPE[project.type] ou getProjectPhases(type). */
export const PROJECT_PHASES: ProjectPhase[] = PROJECT_PHASES_BY_TYPE.investment;

export function getProjectPhases(type: ProjectType): ProjectPhase[] {
  return PROJECT_PHASES_BY_TYPE[type];
}

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
  | "financing"     // auto-coche si ≥ 1 ligne de financement (externe)
  | "milestone"     // auto-coche si ≥ 1 jalon
  | "field"         // champ(s) à remplir sur le projet (cf. fields)
  | "identity"      // titre + description + objectifs + photo
  // ── Nouveaux kinds (migration 029) ──
  | "deliberation"  // passage en instance
  | "authorization" // arrêté / déclaration / autorisation
  | "communication" // action de com
  | "budget";       // budget INTERNE (lignes dépenses + recettes propres)

export type DeliverableLink =
  | "documents"
  | "stakeholders"
  | "financings"
  | "milestones"
  | "objectifs"
  | "pilots"        // pilote élu + pilote agent
  | "lifecycle"
  | "cost10y"       // alias parlant — pointe sur la même section que lifecycle
  | "bilan"
  | "commissions"
  | "authorizations"
  | "communication"
  | "budget";

/** Kinds par nature répétables (l'utilisateur peut en créer plusieurs). */
export const REPEATABLE_KINDS: ReadonlySet<DeliverableKind> = new Set<DeliverableKind>([
  "document",
  "stakeholder",
  "financing",
  "milestone",
  "deliberation",
  "authorization",
  "communication",
]);

export interface DeliverableSpec {
  /** Libellé court visible à l'utilisateur. */
  label: string;
  /** Type → détermine l'UI et l'auto-détection. */
  kind: DeliverableKind;
  /** Section cible vers laquelle pointe le bouton « Compléter ». */
  link?: DeliverableLink;
  /** Optionnel = ne compte pas dans la progression obligatoire. */
  optional?: boolean;
  /** Répétable = plusieurs instances possibles. Default déduit du kind. */
  repeatable?: boolean;
}

export function isDeliverableRepeatable(d: DeliverableSpec): boolean {
  return d.repeatable ?? REPEATABLE_KINDS.has(d.kind);
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
  // ═══════════════════════════════════════════════
  // Gabarit INVESTMENT (7 phases)
  // ═══════════════════════════════════════════════
  emergence: {
    arrivedWith: "Une idée, un besoin du terrain, un signalement.",
    objective:
      "Caractériser l'opportunité pour décider si elle mérite d'être étudiée. C'est l'étape la moins coûteuse — le rôle ici est de cadrer et trier.",
    deliverables: [
      { label: "Identité du projet : titre, description, objectifs, photo, commission de rattachement, enveloppe indicative.", kind: "identity" },
      { label: "Document(s) annexe(s) utile(s).", kind: "document", link: "documents", optional: true },
      { label: "Désignation d'un pilote élu et d'un pilote agent.", kind: "field", link: "pilots" },
      { label: "Identification des parties prenantes clés.", kind: "stakeholder", link: "stakeholders", repeatable: true },
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
      { label: "Coût global du scénario retenu sur 10 ans.", kind: "field", link: "cost10y" },
      { label: "Pré-identification des financeurs potentiels.", kind: "financing", link: "financings", repeatable: true },
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
      { label: "Délibération de principe au Conseil municipal.", kind: "deliberation" },
      { label: "Inscription du projet au PPI (Plan Pluriannuel d'Investissement).", kind: "task" },
      { label: "Autorisation de programme et crédits de paiement votés (AP/CP).", kind: "deliberation" },
      { label: "Information publique du lancement.", kind: "communication", link: "communication" },
    ],
    gate:
      "Le budget est voté et les crédits sont disponibles pour engager la suite.",
  },
  financement: {
    arrivedWith: "Un budget voté et des financeurs identifiés.",
    objective:
      "Sécuriser le tour de table financier AVANT d'engager juridiquement les marchés. Le cycle de chaque ligne (déposé → AR reçu → notifié → soldé) se suit sur la ligne de financement.",
    deliverables: [
      { label: "Dépôt des dossiers de subvention (DETR, DSIL, Département, Région…).", kind: "financing", link: "financings", repeatable: true },
      { label: "Part d'autofinancement arbitrée (emprunt / fonds propres).", kind: "field", link: "financings" },
      { label: "Plan de financement consolidé et validé.", kind: "task" },
    ],
    gate:
      "Porte de financement : autofinancement assumé OU au moins 1 subvention notifiée. ⚠ Aucun marché ne doit être notifié tant que l'AR n'est pas reçu.",
  },
  conception_marches: {
    arrivedWith: "Un financement sécurisé et la porte de financement franchie.",
    objective:
      "Concevoir le projet (maîtrise d'œuvre) et passer les marchés de travaux dans le respect de la commande publique.",
    deliverables: [
      { label: "Désignation du maître d'œuvre.", kind: "stakeholder", link: "stakeholders", repeatable: true },
      { label: "APS, APD, PRO (avant-projet sommaire, définitif, projet).", kind: "document", link: "documents" },
      { label: "Publication des marchés de travaux (BOAMP/JOUE).", kind: "milestone", link: "milestones" },
      { label: "Analyse des offres.", kind: "document", link: "documents" },
      { label: "Attribution du / des marché(s).", kind: "deliberation" },
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
      { label: "Comptes-rendus de chantier réguliers.", kind: "document", link: "documents", repeatable: true },
      { label: "Avenants éventuels approuvés.", kind: "document", link: "documents", optional: true, repeatable: true },
      { label: "PV de réception et levée des réserves.", kind: "milestone", link: "milestones" },
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
      { label: "Archivage des pièces administratives.", kind: "task" },
      { label: "Réintégration des données de coût d'exploitation au PPI futur.", kind: "task" },
    ],
    gate:
      "Le bilan est validé et le projet peut être archivé sereinement.",
  },

  // ═══════════════════════════════════════════════
  // Gabarit EVENT (5 phases)
  // ═══════════════════════════════════════════════
  event_framing: {
    arrivedWith: "Une envie de manifestation, une date pressentie, une occasion.",
    objective:
      "Définir ce qu'on organise, pour qui et avec quel ordre de grandeur budgétaire, et désigner qui pilote. C'est l'étape qui transforme une idée de fête en projet engagé.",
    deliverables: [
      { label: "Identité : titre, description, date(s), public visé, commission de rattachement, enveloppe indicative, photo.", kind: "identity" },
      { label: "Désignation d'un pilote élu et d'un pilote agent.", kind: "field", link: "pilots" },
      { label: "Parties prenantes (associations, prestataires, partenaires, bénévoles).", kind: "stakeholder", link: "stakeholders", optional: true, repeatable: true },
    ],
    gate: "Le concept est validé, la date est arrêtée : on engage l'organisation.",
  },
  event_authorizations: {
    arrivedWith: "Un concept validé et une date arrêtée.",
    objective:
      "Couvrir le volet réglementaire : c'est le vrai nerf d'un événementiel. Aucune manifestation ne se tient sans ses autorisations obligatoires.",
    deliverables: [
      { label: "Arrêtés municipaux (occupation du domaine public, débit de boissons temporaire, circulation / stationnement).", kind: "authorization", link: "authorizations", repeatable: true },
      { label: "Déclarations réglementaires (préfecture si grand rassemblement, SACEM / SPRE, buvette).", kind: "authorization", link: "authorizations", repeatable: true },
      { label: "Dossier sécurité (commission de sécurité si ERP / grand rassemblement, dispositif prévisionnel de secours).", kind: "authorization", link: "authorizations", optional: true },
      { label: "Assurance de la manifestation souscrite.", kind: "task" },
    ],
    gate: "Toutes les autorisations obligatoires sont obtenues ou déposées.",
  },
  event_logistics: {
    arrivedWith: "Le cadre réglementaire est sécurisé.",
    objective:
      "Réserver, chiffrer, communiquer et organiser les moyens humains. Le budget intègre ici les recettes propres (buvette, billetterie, mécénat).",
    deliverables: [
      { label: "Budget prévisionnel (dépenses + recettes : buvette, billetterie, mécénat, subventions).", kind: "budget", link: "budget" },
      { label: "Réservations et commandes (lieu, matériel, prestataires).", kind: "milestone", link: "milestones", repeatable: true },
      { label: "Planning des bénévoles et des agents.", kind: "task" },
      { label: "Plan de communication (affiche, presse, réseaux sociaux, site, agenda).", kind: "communication", link: "communication", repeatable: true },
    ],
    gate: "Le budget est bouclé, la logistique est réservée, la communication est lancée.",
  },
  event_dday: {
    arrivedWith: "Tout est réservé, autorisé et communiqué.",
    objective:
      "Dérouler la manifestation et coordonner les équipes du montage au démontage, en gardant la sécurité comme fil rouge.",
    deliverables: [
      { label: "Checklist de montage et installation.", kind: "task" },
      { label: "Déroulé et coordination le jour J.", kind: "task" },
      { label: "Démontage et remise en état du site.", kind: "task" },
    ],
    gate: "La manifestation est tenue et le site est rendu.",
  },
  event_review: {
    arrivedWith: "La manifestation est passée et les factures arrivent.",
    objective:
      "Mesurer ce que ça a coûté et rapporté, ce que ça a rassemblé, et décider si on reconduit. C'est ce qui fait gagner du temps l'année suivante.",
    deliverables: [
      { label: "Bilan financier réel (dépenses / recettes vs prévu).", kind: "field", link: "bilan" },
      { label: "Bilan de fréquentation et retours.", kind: "document", link: "documents" },
      { label: "Décision de reconduction (oui / non) et points d'amélioration.", kind: "task" },
    ],
    gate: "Le bilan est partagé et la décision de reconduction est prise.",
  },

  // ═══════════════════════════════════════════════
  // Gabarit TRACKING (3 phases)
  // ═══════════════════════════════════════════════
  tracking_framing: {
    arrivedWith: "Une action à mener, un sujet à suivre, une démarche à lancer.",
    objective:
      "Poser l'objectif, le rattacher à une commission et désigner qui pilote. Volontairement léger : pas de faisabilité ni de marché ici.",
    deliverables: [
      { label: "Identité : titre, objectif, commission de rattachement, enveloppe indicative, photo.", kind: "identity" },
      { label: "Désignation d'un pilote élu et d'un pilote agent.", kind: "field", link: "pilots" },
      { label: "Document(s) de référence.", kind: "document", link: "documents", optional: true, repeatable: true },
      { label: "Parties prenantes éventuelles.", kind: "stakeholder", link: "stakeholders", optional: true, repeatable: true },
    ],
    gate: "L'objectif est clair, un pilote est désigné : on lance.",
  },
  tracking_execution: {
    arrivedWith: "Un objectif cadré et un pilote.",
    objective:
      "Avancer par jalons et tenir le fil des actions. Un budget ou un financement ponctuel peut être suivi ici si le projet en a un.",
    deliverables: [
      { label: "Jalons et étapes.", kind: "milestone", link: "milestones", repeatable: true },
      { label: "Actions et tâches à mener.", kind: "task", repeatable: true },
      { label: "Budget ou financement éventuel.", kind: "budget", link: "budget", optional: true },
      { label: "Pièces produites.", kind: "document", link: "documents", optional: true, repeatable: true },
    ],
    gate: "Les actions sont engagées et les livrables avancent.",
  },
  tracking_review: {
    arrivedWith: "Des actions menées ou un cycle écoulé.",
    objective:
      "Faire le point. Pour un projet ponctuel, c'est la clôture ; pour une démarche continue, c'est un point d'étape qui relance un nouveau cycle.",
    deliverables: [
      { label: "Point d'étape / bilan.", kind: "field", link: "bilan" },
      { label: "Retours et ajustements.", kind: "task" },
      { label: "Décision : clôturer ou reconduire pour un nouveau cycle.", kind: "task" },
    ],
    gate: "Le bilan est posé : le projet est clôturé OU reconduit.",
  },
};

/** Retourne la guide d'une phase (ou null si la phase n'existe pas). */
export function getPhaseGuide(phase: ProjectPhase): PhaseGuideEntry | null {
  return PROJECT_PHASE_GUIDE[phase] ?? null;
}

/** Retourne les guides ordonnés des phases d'un gabarit. */
export function getPhasesGuideForType(
  type: ProjectType,
): { phase: ProjectPhase; guide: PhaseGuideEntry }[] {
  return PROJECT_PHASES_BY_TYPE[type].map((phase) => ({
    phase,
    guide: PROJECT_PHASE_GUIDE[phase],
  }));
}

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
  event_framing: "•",
  event_authorizations: "•",
  event_logistics: "•",
  event_dday: "•",
  event_review: "•",
  tracking_framing: "•",
  tracking_execution: "•",
  tracking_review: "•",
};

/** Identifiants symboliques pour résoudre vers une icône Lucide
 *  côté composants UI (cf. src/components/projects/PhaseIcon.tsx).
 *  Choix d'icônes fines et neutres, pas d'emoji. */
export const PROJECT_PHASE_LUCIDE: Record<ProjectPhase, string> = {
  // investment
  emergence: "Lightbulb",
  faisabilite: "Search",
  decision_budget: "Landmark",
  financement: "Wallet",
  conception_marches: "Ruler",
  realisation: "HardHat",
  bilan_cloture: "Flag",
  // event
  event_framing: "Lightbulb",
  event_authorizations: "ShieldCheck",
  event_logistics: "Truck",
  event_dday: "PartyPopper",
  event_review: "Flag",
  // tracking
  tracking_framing: "Lightbulb",
  tracking_execution: "ListChecks",
  tracking_review: "Flag",
};

export const PROJECT_PHASE_SHORT: Record<ProjectPhase, string> = {
  // investment
  emergence: "Émergence",
  faisabilite: "Faisabilité",
  decision_budget: "Décision",
  financement: "Financement",
  conception_marches: "Conception",
  realisation: "Travaux",
  bilan_cloture: "Clôture",
  // event
  event_framing: "Cadrage",
  event_authorizations: "Autorisations",
  event_logistics: "Logistique",
  event_dday: "Jour J",
  event_review: "Bilan",
  // tracking
  tracking_framing: "Cadrage",
  tracking_execution: "Mise en œuvre",
  tracking_review: "Bilan",
};

// ─── Métadonnées des gabarits (cartes de sélection à la création) ───

export interface ProjectTypeMeta {
  type: ProjectType;
  label: string;
  tagline: string;
  example: string;
  /** Commissions qui pré-suggèrent ce type (sous-chaîne case-insensitive). */
  suggestedForCommissions: string[];
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  investment: "Investissement structurant",
  event: "Événementiel",
  tracking: "Suivi simple / démarche",
};

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeMeta> = {
  investment: {
    type: "investment",
    label: "Investissement structurant",
    tagline: "Bureau d'études, marchés publics, subventions, AP/CP.",
    example: "Rénovation du clocher, réfection de voirie, médiathèque.",
    suggestedForCommissions: ["Voirie", "Bâtiments", "Urbanisme", "Travaux"],
  },
  event: {
    type: "event",
    label: "Événementiel",
    tagline: "Autorisations, logistique, jour J, bilan.",
    example: "Fête communale, commémoration, marché de Noël.",
    suggestedForCommissions: ["Animation", "Fêtes", "Culture", "Vie associative"],
  },
  tracking: {
    type: "tracking",
    label: "Suivi simple / démarche",
    tagline: "Objectif, jalons, bilan. Léger, sans marché.",
    example: "Achat de jeux pour l'école, végétalisation du bourg, zéro phyto.",
    suggestedForCommissions: ["Environnement", "Scolaire", "Social"],
  },
};

/** Pré-suggère un type à partir de la commission de rattachement. */
export function suggestProjectType(commission: string | null | undefined): ProjectType {
  if (!commission) return "tracking";
  const c = commission.toLowerCase();
  for (const meta of Object.values(PROJECT_TYPE_META)) {
    if (meta.suggestedForCommissions.some((s) => c.includes(s.toLowerCase()))) {
      return meta.type;
    }
  }
  return "tracking";
}

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

// ─── Nouvelles entités (migration 029) ───

export type AuthorizationType =
  | "arrete_municipal"
  | "declaration_prefecture"
  | "sacem"
  | "securite"
  | "erp"
  | "debit_boisson"
  | "autre";

export const AUTHORIZATION_TYPE_LABELS: Record<AuthorizationType, string> = {
  arrete_municipal: "Arrêté municipal",
  declaration_prefecture: "Déclaration préfecture",
  sacem: "SACEM / SPRE",
  securite: "Dossier sécurité",
  erp: "Commission ERP",
  debit_boisson: "Débit de boisson temporaire",
  autre: "Autre",
};

export type AuthorizationStatus = "a_obtenir" | "depose" | "obtenu" | "refuse";

export const AUTHORIZATION_STATUS_LABELS: Record<AuthorizationStatus, string> = {
  a_obtenir: "À obtenir",
  depose: "Déposé",
  obtenu: "Obtenu",
  refuse: "Refusé",
};

export type CommunicationCanal =
  | "affiche"
  | "presse"
  | "reseaux"
  | "site"
  | "agenda"
  | "mailing"
  | "panneau"
  | "autre";

export const COMMUNICATION_CANAL_LABELS: Record<CommunicationCanal, string> = {
  affiche: "Affiche",
  presse: "Presse",
  reseaux: "Réseaux sociaux",
  site: "Site web",
  agenda: "Agenda municipal",
  mailing: "Mailing",
  panneau: "Panneau lumineux",
  autre: "Autre",
};

export type CommunicationStatus = "a_faire" | "planifie" | "diffuse";

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> = {
  a_faire: "À faire",
  planifie: "Planifié",
  diffuse: "Diffusé",
};

export type BudgetSens = "depense" | "recette";

export type BudgetCategorie =
  | "buvette"
  | "billetterie"
  | "mecenat"
  | "subvention"
  | "prestataire"
  | "materiel"
  | "location"
  | "personnel"
  | "communication"
  | "autre";

export const BUDGET_CATEGORIE_LABELS: Record<BudgetCategorie, string> = {
  buvette: "Buvette",
  billetterie: "Billetterie",
  mecenat: "Mécénat",
  subvention: "Subvention",
  prestataire: "Prestataire",
  materiel: "Matériel",
  location: "Location",
  personnel: "Personnel",
  communication: "Communication",
  autre: "Autre",
};

export interface ProjectDeliberation {
  id: string;
  project_id: string;
  phase: ProjectPhase;
  date_seance: string;
  numero: string | null;
  objet: string;
  lien_pv: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAuthorization {
  id: string;
  project_id: string;
  phase: ProjectPhase;
  type: AuthorizationType;
  libelle: string;
  statut: AuthorizationStatus;
  echeance: string | null;
  obtenu_le: string | null;
  document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCommunication {
  id: string;
  project_id: string;
  phase: ProjectPhase;
  canal: CommunicationCanal;
  libelle: string;
  date_prevue: string | null;
  date_diffusion: string | null;
  statut: CommunicationStatus;
  lien: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBudgetLine {
  id: string;
  project_id: string;
  /** Null = ligne transversale au projet (non rattachée à une phase). */
  phase: ProjectPhase | null;
  sens: BudgetSens;
  categorie: BudgetCategorie | null;
  libelle: string;
  montant_prevu: number | null;
  montant_reel: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

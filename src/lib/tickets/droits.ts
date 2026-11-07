// ═══════════════════════════════════════════════════════════════
// Droits sur les signalements (lot 1) — logique pure.
//
// Miroir 1:1 de `user_voit_ticket()` (migration 058) pour la
// visibilité. Les droits d'action (matrice) ne sont vérifiés que
// côté serveur, ici.
//
// Trois briques seulement :
//   • la fonction de la personne (profiles.job_title) ;
//   • la matrice fonction × action de sa commune (super-admin) ;
//   • ses services (portée « son service »).
// Créateur, assignés et destinataires voient toujours le signalement,
// sauf fonction réglée sur « rien ». Super-admin : tout.
// ═══════════════════════════════════════════════════════════════

export type Fonction =
  | "maire" | "dgs" | "secretaire" | "dst" | "adjoint" | "conseiller"
  | "responsable_service" | "agent" | "accueil" | "autre";

export const FONCTIONS_MATRICE: Array<{ fonction: Fonction; libelle: string }> = [
  { fonction: "maire", libelle: "Maire" },
  { fonction: "dgs", libelle: "Directeur général des services" },
  { fonction: "secretaire", libelle: "Secrétaire générale / SG" },
  { fonction: "dst", libelle: "Directeur des services techniques" },
  { fonction: "adjoint", libelle: "Adjoint (élu délégué)" },
  { fonction: "conseiller", libelle: "Conseiller municipal" },
  { fonction: "responsable_service", libelle: "Responsable de service" },
  { fonction: "agent", libelle: "Agent" },
  { fonction: "accueil", libelle: "Accueil / secrétariat" },
  { fonction: "autre", libelle: "Autre ou non renseignée" },
];

export type Portee = "rien" | "siens" | "service" | "commune";
export const PORTEES: Array<{ valeur: Portee; libelle: string }> = [
  { valeur: "rien", libelle: "Rien" },
  { valeur: "siens", libelle: "Ses tickets" },
  { valeur: "service", libelle: "Son service" },
  { valeur: "commune", libelle: "Toute la commune" },
];

export type ValeurAction = "oui" | "non" | "si_assigne";

export type Action =
  | "creer" | "modifier" | "assigner" | "changer_service" | "cloturer"
  | "rouvrir" | "commenter" | "changer_visibilite" | "exporter";

export const ACTIONS: Array<{ action: Action; libelle: string; siAssignePossible: boolean }> = [
  { action: "creer", libelle: "Créer", siAssignePossible: false },
  { action: "modifier", libelle: "Modifier", siAssignePossible: true },
  { action: "assigner", libelle: "Assigner", siAssignePossible: true },
  { action: "changer_service", libelle: "Changer de service", siAssignePossible: false },
  { action: "cloturer", libelle: "Clôturer", siAssignePossible: true },
  { action: "rouvrir", libelle: "Rouvrir", siAssignePossible: false },
  { action: "commenter", libelle: "Commenter", siAssignePossible: false },
  { action: "changer_visibilite", libelle: "Changer la visibilité", siAssignePossible: false },
  { action: "exporter", libelle: "Exporter", siAssignePossible: false },
];

export interface LigneMatrice {
  fonction: Fonction;
  voit: Portee;
  voit_restreints: boolean;
  actions: Record<Action, ValeurAction>;
}

export type Confidentialite = "standard" | "restreint" | "confidentiel";
export const CONFIDENTIALITE_LABELS: Record<Confidentialite, string> = {
  standard: "Standard",
  restreint: "Restreint",
  confidentiel: "Confidentiel",
};
export const CONFIDENTIALITE_AIDE: Record<Confidentialite, string> = {
  standard: "Visible selon les règles de la commune (service, élus, direction).",
  restreint: "Visible des personnes choisies et de la direction.",
  confidentiel: "Visible uniquement des personnes choisies.",
};

/** Ligne de la matrice correspondant à une fonction (miroir de `ticket_fonction`). */
export function fonctionDe(jobTitle: string | null | undefined): Fonction {
  switch (jobTitle) {
    case "maire": case "adjoint": case "conseiller": case "dgs": case "dst":
    case "secretaire": case "responsable_service": case "accueil":
      return jobTitle;
    case "agent": case "agent_technique":
      return "agent";
    default:
      return "autre";
  }
}

const TOUT: Record<Action, ValeurAction> = {
  creer: "oui", modifier: "oui", assigner: "oui", changer_service: "oui", cloturer: "oui",
  rouvrir: "oui", commenter: "oui", changer_visibilite: "oui", exporter: "oui",
};
const RIEN: Record<Action, ValeurAction> = {
  creer: "non", modifier: "non", assigner: "non", changer_service: "non", cloturer: "non",
  rouvrir: "non", commenter: "non", changer_visibilite: "non", exporter: "non",
};
const COMPAT: Record<Action, ValeurAction> = { ...TOUT, changer_visibilite: "non" };

/** Matrice par défaut d'une commune (miroir de `ticket_matrice_seed(…, false)`). */
export const MATRICE_DEFAUT: LigneMatrice[] = [
  { fonction: "maire", voit: "commune", voit_restreints: true, actions: TOUT },
  { fonction: "dgs", voit: "commune", voit_restreints: true, actions: TOUT },
  { fonction: "secretaire", voit: "commune", voit_restreints: true, actions: TOUT },
  { fonction: "dst", voit: "commune", voit_restreints: true, actions: TOUT },
  { fonction: "adjoint", voit: "service", voit_restreints: false, actions: { ...RIEN, creer: "oui", commenter: "oui", exporter: "oui" } },
  { fonction: "conseiller", voit: "siens", voit_restreints: false, actions: { ...RIEN, creer: "oui", commenter: "oui" } },
  { fonction: "responsable_service", voit: "service", voit_restreints: false, actions: TOUT },
  { fonction: "agent", voit: "service", voit_restreints: false, actions: { ...RIEN, creer: "oui", modifier: "si_assigne", assigner: "si_assigne", cloturer: "si_assigne", commenter: "oui" } },
  { fonction: "accueil", voit: "siens", voit_restreints: false, actions: { ...RIEN, creer: "oui", commenter: "oui" } },
  { fonction: "autre", voit: "rien", voit_restreints: false, actions: RIEN },
];

/** Matrice « compatibilité » posée sur les communes déjà équipées (comportement d'avant). */
export const MATRICE_COMPAT: LigneMatrice[] = MATRICE_DEFAUT.map((l) =>
  l.voit_restreints ? l : { ...l, voit: "commune" as Portee, actions: COMPAT },
);

/** Ligne lue en base → ligne complète (toute action absente ou inconnue vaut « non »). */
export function normaliserLigne(row: {
  fonction: string; voit: string; voit_restreints: boolean; actions: unknown;
}): LigneMatrice {
  const brut = (row.actions && typeof row.actions === "object" ? row.actions : {}) as Record<string, unknown>;
  const actions = { ...RIEN };
  for (const { action, siAssignePossible } of ACTIONS) {
    const v = brut[action];
    if (v === "oui" || (v === "si_assigne" && siAssignePossible)) actions[action] = v;
  }
  const voit = (["rien", "siens", "service", "commune"] as const).includes(row.voit as Portee) ? (row.voit as Portee) : "rien";
  return { fonction: fonctionDe(row.fonction), voit, voit_restreints: !!row.voit_restreints, actions };
}

/** Qui regarde. `ligne` null = aucune ligne de matrice (rien). */
export interface Spectateur {
  id: string;
  role: string | null;
  communeId: string | null;
  ligne: LigneMatrice | null;
  services: ReadonlySet<string>;
}

/** Ce qu'il faut savoir d'un signalement pour décider. */
export interface TicketPourDroits {
  commune_id: string;
  created_by: string | null;
  assigne_a: string | null;
  service_id?: string | null;
  confidentialite?: Confidentialite | string | null;
  assignes: readonly string[];
  destinataires: readonly string[];
}

export function estSuperAdmin(s: Spectateur): boolean {
  return s.role === "super_admin";
}

/** Créateur, assigné ou destinataire nommé. */
export function estImplique(t: TicketPourDroits, userId: string): boolean {
  return t.created_by === userId || t.assigne_a === userId
    || t.assignes.includes(userId) || t.destinataires.includes(userId);
}

export function estAssigne(t: TicketPourDroits, userId: string): boolean {
  return t.assigne_a === userId || t.assignes.includes(userId);
}

/** Miroir 1:1 de `user_voit_ticket()`. */
export function peutVoirTicket(t: TicketPourDroits, s: Spectateur): boolean {
  if (estSuperAdmin(s)) return true;
  if (s.role !== "admin" && s.role !== "editor") return false;
  if (!s.communeId || t.commune_id !== s.communeId) return false;
  const l = s.ligne;
  if (!l || l.voit === "rien") return false;
  if (estImplique(t, s.id)) return true;
  const niveau = t.confidentialite ?? "standard";
  if (niveau === "confidentiel") return false;
  if (niveau === "restreint") return l.voit_restreints;
  if (l.voit === "commune") return true;
  if (l.voit === "service") return !!t.service_id && s.services.has(t.service_id);
  return false;
}

/** Valeur brute d'une action pour ce spectateur ('oui' pour le super-admin). */
export function valeurAction(action: Action, s: Spectateur): ValeurAction {
  if (estSuperAdmin(s)) return "oui";
  return s.ligne?.actions[action] ?? "non";
}

/** Peut créer un signalement (pas de « si assigné » pour la création). */
export function peutCreer(s: Spectateur): boolean {
  if (estSuperAdmin(s)) return true;
  if (s.role !== "admin" && s.role !== "editor") return false;
  return !!s.ligne && s.ligne.voit !== "rien" && valeurAction("creer", s) === "oui";
}

/**
 * Peut faire `action` sur ce signalement. Il faut d'abord le voir.
 * « si_assigne » : seulement sur un signalement qui lui est assigné.
 * Le créateur gère toujours la visibilité et les destinataires de son signalement.
 */
export function peutAgir(action: Action, t: TicketPourDroits, s: Spectateur): boolean {
  if (estSuperAdmin(s)) return true;
  if (!peutVoirTicket(t, s)) return false;
  if (action === "changer_visibilite" && t.created_by === s.id) return true;
  const v = valeurAction(action, s);
  if (v === "oui") return true;
  if (v === "si_assigne") return estAssigne(t, s.id);
  return false;
}

/**
 * Prendre en charge un signalement non assigné : « assigner » à
 * « si_assigne » vaut « s'assigner soi-même ».
 */
export function peutPrendreEnCharge(t: TicketPourDroits, s: Spectateur): boolean {
  if (!peutVoirTicket(t, s)) return false;
  if (peutAgir("modifier", t, s) || peutAgir("assigner", t, s)) return true;
  return valeurAction("assigner", s) === "si_assigne";
}

/**
 * Assignation demandée par quelqu'un dont le droit est « si_assigne » :
 * il ne peut que s'ajouter lui-même, sans retirer personne.
 */
export function assignationAutorisee(
  t: TicketPourDroits, s: Spectateur, actuels: readonly string[], voulus: readonly string[],
): boolean {
  if (peutAgir("assigner", t, s) && valeurAction("assigner", s) === "oui") return true;
  if (!peutVoirTicket(t, s) || valeurAction("assigner", s) !== "si_assigne") return estSuperAdmin(s);
  const retires = actuels.filter((id) => !voulus.includes(id));
  const ajoutes = voulus.filter((id) => !actuels.includes(id));
  return retires.length === 0 && ajoutes.every((id) => id === s.id);
}

export type DroitsTicket = Record<Action, boolean> & { voir: boolean; prendreEnCharge: boolean };

/** Tous les droits d'un spectateur sur un signalement (pour l'affichage des boutons). */
export function droitsSurTicket(t: TicketPourDroits, s: Spectateur): DroitsTicket {
  const d = { voir: peutVoirTicket(t, s), prendreEnCharge: peutPrendreEnCharge(t, s) } as DroitsTicket;
  for (const { action } of ACTIONS) d[action] = peutAgir(action, t, s);
  return d;
}

/** Signalement sensible : consultations et modifications journalisées. */
export function estSensible(t: { confidentialite?: string | null }): boolean {
  return t.confidentialite === "restreint" || t.confidentialite === "confidentiel";
}

/** Restreint et confidentiel exigent au moins un destinataire nommé. */
export function verifierVisibilite(niveau: string, destinataires: readonly string[]): Confidentialite {
  if (niveau !== "standard" && niveau !== "restreint" && niveau !== "confidentiel") {
    throw new Error("Niveau de visibilité inconnu");
  }
  if (niveau !== "standard" && destinataires.length === 0) {
    throw new Error("Choisissez au moins une personne qui pourra voir ce signalement.");
  }
  return niveau;
}

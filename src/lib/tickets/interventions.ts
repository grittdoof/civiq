// ═══════════════════════════════════════════════════════════════
// Parcours « Mes interventions » (lot 3, maquette 1A) — logique pure.
//
// • Page d'arrivée selon le profil (PWA et connexion).
// • Vues de la liste selon la matrice de la commune.
// • Regroupement par urgence, tri par délai puis ancienneté.
// • Action rapide proposée sur chaque ligne.
// ═══════════════════════════════════════════════════════════════

import { URGENCE_RANG, type Urgence } from "./categories";
import type { DroitsTicket, Fonction, LigneMatrice } from "./droits";

export type Vue = "moi" | "service" | "non_assignes" | "demandes" | "tous";

export const VUE_LABELS: Record<Vue, string> = {
  moi: "À moi",
  service: "Mon service",
  non_assignes: "Non assignés",
  demandes: "Mes demandes",
  tous: "Tous",
};

/** « Mon service » s'appelle « Ma délégation » pour un adjoint. */
export function libelleVue(v: Vue, fonction: Fonction): string {
  if (v === "service" && fonction === "adjoint") return "Ma délégation";
  return VUE_LABELS[v];
}

const DIRECTION: Fonction[] = ["maire", "dgs", "secretaire", "dst"];

/**
 * Page d'arrivée : agent → ses interventions, responsable → son service,
 * adjoint → sa délégation, accueil / conseiller → ses demandes, maire et
 * direction → tableau de bord. Sans module Tickets : tableau de bord.
 */
export function pageAccueil(opts: { role: string | null; fonction: Fonction; ticketsActif: boolean }): string {
  if (!opts.ticketsActif || opts.role === "super_admin" || DIRECTION.includes(opts.fonction)) return "/admin/dashboard";
  switch (opts.fonction) {
    case "agent": return "/admin/tickets?vue=moi";
    case "responsable_service":
    case "adjoint": return "/admin/tickets?vue=service";
    case "accueil":
    case "conseiller": return "/admin/tickets?vue=demandes";
    default: return "/admin/dashboard";
  }
}

/** Vues proposées, dans l'ordre des onglets. */
export function vuesDisponibles(opts: { role: string | null; ligne: LigneMatrice | null; aDesServices: boolean }): Vue[] {
  if (opts.role === "super_admin") return ["tous", "moi", "non_assignes", "demandes"];
  const l = opts.ligne;
  if (!l || l.voit === "rien") return [];
  const vues: Vue[] = ["moi"];
  if (opts.aDesServices && (l.voit === "service" || l.voit === "commune")) vues.push("service");
  if ((l.voit === "service" || l.voit === "commune") && l.actions.assigner !== "non") vues.push("non_assignes");
  vues.push("demandes");
  if (l.voit === "commune") vues.push("tous");
  return vues;
}

/** Vue par défaut d'une fonction, parmi celles disponibles. */
export function vueParDefaut(fonction: Fonction, vues: Vue[]): Vue {
  const prefere: Vue = DIRECTION.includes(fonction) ? "tous"
    : fonction === "agent" ? "moi"
    : fonction === "responsable_service" || fonction === "adjoint" ? "service"
    : fonction === "accueil" || fonction === "conseiller" ? "demandes"
    : "tous";
  return vues.includes(prefere) ? prefere : vues[0] ?? "moi";
}

export interface LigneIntervention {
  id: string;
  created_at: string;
  created_by: string | null;
  assigne_a: string | null;
  assignee_ids?: string[];
  service_id?: string | null;
  urgence?: Urgence | null;
  delai_cible_le?: string | null;
  statut: string;
}

const OUVERTS = new Set(["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"]);
export const estOuvert = (statut: string) => OUVERTS.has(statut);

export function estAMoi(t: LigneIntervention, userId: string): boolean {
  return t.assigne_a === userId || (t.assignee_ids ?? []).includes(userId);
}

/** Filtre une liste (déjà limitée aux tickets visibles) selon la vue. */
export function filtrerVue<T extends LigneIntervention>(
  tickets: T[], vue: Vue, userId: string, services: ReadonlySet<string>,
): T[] {
  switch (vue) {
    case "moi": return tickets.filter((t) => estAMoi(t, userId));
    case "service": return tickets.filter((t) => !!t.service_id && services.has(t.service_id));
    case "non_assignes": return tickets.filter((t) => !t.assigne_a && (t.assignee_ids ?? []).length === 0);
    case "demandes": return tickets.filter((t) => t.created_by === userId);
    default: return tickets;
  }
}

/** Tri d'une file d'interventions : urgence, puis délai cible le plus proche, puis plus ancien. */
export function trierInterventions<T extends LigneIntervention>(tickets: T[]): T[] {
  const rang = (t: T) => URGENCE_RANG[t.urgence ?? "normale"];
  const delai = (t: T) => (t.delai_cible_le ? new Date(t.delai_cible_le).getTime() : Number.POSITIVE_INFINITY);
  return [...tickets].sort((a, b) =>
    rang(a) - rang(b) || delai(a) - delai(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Sections par urgence (vides omises), dans l'ordre danger → faible. */
export function grouperParUrgence<T extends LigneIntervention>(tickets: T[]): Array<{ urgence: Urgence; tickets: T[] }> {
  const ordre: Urgence[] = ["danger_immediat", "urgente", "normale", "faible"];
  const tries = trierInterventions(tickets);
  return ordre
    .map((u) => ({ urgence: u, tickets: tries.filter((t) => (t.urgence ?? "normale") === u) }))
    .filter((g) => g.tickets.length > 0);
}

export type ActionRapide = "prendre" | "cloturer" | "photo" | null;

/**
 * Action proposée sur la ligne : prendre en charge un ticket qui ne
 * m'est pas assigné ; clôturer celui qui m'est assigné ; à défaut
 * ajouter une photo si je peux le modifier.
 */
export function actionRapide(t: LigneIntervention, droits: DroitsTicket, userId: string): ActionRapide {
  if (!estOuvert(t.statut)) return null;
  const aMoi = estAMoi(t, userId);
  if (!aMoi && droits.prendreEnCharge && t.statut !== "pris_en_charge" && t.statut !== "en_cours") return "prendre";
  if (aMoi && droits.cloturer) return "cloturer";
  if (droits.modifier) return "photo";
  return null;
}

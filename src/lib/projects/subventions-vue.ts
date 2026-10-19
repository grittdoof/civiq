// ═══════════════════════════════════════════════════════════════
// Présentation des demandes de subvention (onglet Financeurs) —
// logique pure : regroupement par état, frise déposé → AR → décision,
// sigle du dispositif (DETR, DSIL…).
// ═══════════════════════════════════════════════════════════════

import { subventionSansAr } from "./financement";

export type GroupeSubvention = "relancer" | "deposer" | "attente_ar" | "etude" | "accorde" | "solde" | "refuse";

export const GROUPES_SUBVENTION: Array<{ cle: GroupeSubvention; label: string; ton: "danger" | "neutre" | "warning" | "info" | "succes" }> = [
  { cle: "relancer", label: "À relancer", ton: "danger" },
  { cle: "deposer", label: "À déposer", ton: "neutre" },
  { cle: "attente_ar", label: "En attente d'accusé de réception", ton: "warning" },
  { cle: "etude", label: "En cours d'étude", ton: "info" },
  { cle: "accorde", label: "Accordé", ton: "succes" },
  { cle: "solde", label: "Soldé", ton: "succes" },
  { cle: "refuse", label: "Refusé", ton: "neutre" },
];

export interface SubventionVue {
  statut: string;
  date_demande: string | null;
  date_ar: string | null;
  date_decision: string | null;
}

export function groupeSubvention(s: SubventionVue, now: Date = new Date()): GroupeSubvention {
  if (subventionSansAr(s, now)) return "relancer";
  switch (s.statut) {
    case "a_demander": return "deposer";
    case "demandee": return "attente_ar";
    case "ar_recu": return "etude";
    case "accordee": return "accorde";
    case "soldee": return "solde";
    case "refusee": return "refuse";
    default: return "deposer";
  }
}

/** Semaines écoulées depuis le dépôt (pour « sans accusé de réception depuis N sem. »). */
export function semainesDepuis(dateIso: string | null, now: Date = new Date()): number | null {
  if (!dateIso) return null;
  const t = Date.parse(`${dateIso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / (7 * 86_400_000)));
}

export type EtapeFrise = { cle: "depot" | "ar" | "decision"; etat: "fait" | "manquant" | "alerte" | "refus" | "attente"; texte: string };

const dateCourte = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** Frise de la demande : déposée → accusé de réception → décision. */
export function friseSubvention(s: SubventionVue, now: Date = new Date()): EtapeFrise[] {
  const depot: EtapeFrise = s.date_demande
    ? { cle: "depot", etat: "fait", texte: `Déposé le ${dateCourte(s.date_demande)}` }
    : { cle: "depot", etat: "attente", texte: "À déposer" };
  let ar: EtapeFrise;
  if (s.date_ar) ar = { cle: "ar", etat: "fait", texte: `AR le ${dateCourte(s.date_ar)}` };
  else if (subventionSansAr(s, now)) {
    const n = semainesDepuis(s.date_demande, now) ?? 3;
    ar = { cle: "ar", etat: "alerte", texte: `Sans accusé de réception depuis ${n} sem.` };
  } else ar = { cle: "ar", etat: "attente", texte: "Accusé de réception" };
  let decision: EtapeFrise;
  const le = s.date_decision ? ` le ${dateCourte(s.date_decision)}` : "";
  if (s.statut === "accordee") decision = { cle: "decision", etat: "fait", texte: `Accordé${le}` };
  else if (s.statut === "soldee") decision = { cle: "decision", etat: "fait", texte: `Soldé${le}` };
  else if (s.statut === "refusee") decision = { cle: "decision", etat: "refus", texte: `Refusé${le}` };
  else decision = { cle: "decision", etat: "attente", texte: s.date_ar ? "Décision en attente" : "Décision" };
  return [depot, ar, decision];
}

const SIGLES: Array<[RegExp, string]> = [
  [/[ée]quipement des territoires ruraux/i, "DETR"],
  [/soutien [àa] l['’]investissement local/i, "DSIL"],
  [/fonds vert/i, "Fonds vert"],
  [/fonds europ[ée]en (agricole )?pour le d[ée]veloppement rural|\bFEADER\b/i, "FEADER"],
  [/\bLEADER\b/, "LEADER"],
];

/** Sigle court du dispositif (badge) et libellé sans le sigle entre parenthèses. */
export function sigleDispositif(dispositif: string | null | undefined): { sigle: string | null; libelle: string | null } {
  const d = dispositif?.trim();
  if (!d) return { sigle: null, libelle: null };
  if (/^[A-Z0-9][A-Z0-9 -]{1,9}$/.test(d)) return { sigle: d, libelle: null };
  const paren = /\s*\(([A-Z][A-Z0-9-]{1,9})\)\s*/.exec(d);
  if (paren) return { sigle: paren[1], libelle: d.replace(paren[0], " ").trim() || null };
  for (const [re, s] of SIGLES) if (re.test(d)) return { sigle: s, libelle: d };
  return { sigle: null, libelle: d };
}

// ═══════════════════════════════════════════════════════════════
// Tickets de rappel programmé — logique pure (testée).
//
// Un rappel reste « En attente » et hors des interventions en cours
// jusqu'à sa date de déclenchement (échéance moins l'anticipation).
// Ce jour-là, la tâche quotidienne l'ouvre et prévient les personnes
// concernées. Répétition annuelle : à la clôture, le rappel de
// l'année suivante est créé.
// ═══════════════════════════════════════════════════════════════

export type Repetition = "aucune" | "annuelle";

export const AVANCES: Array<{ jours: number; libelle: string }> = [
  { jours: 0, libelle: "Le jour même" },
  { jours: 7, libelle: "1 semaine avant" },
  { jours: 30, libelle: "1 mois avant" },
  { jours: 60, libelle: "2 mois avant" },
  { jours: 90, libelle: "3 mois avant" },
];

export function libelleAvance(jours: number): string {
  return AVANCES.find((a) => a.jours === jours)?.libelle ?? `${jours} jours avant`;
}

export interface RappelTicket {
  statut: string;
  rappel_le?: string | null;
  rappel_avance_jours?: number | null;
  rappel_envoye_at?: string | null;
}

/** Rappel pas encore déclenché : hors des interventions en cours. */
export function estRappelProgramme(t: RappelTicket): boolean {
  return !!t.rappel_le && !t.rappel_envoye_at && t.statut === "en_attente";
}

/** « AAAA-MM-JJ » à l'heure de Paris. */
export function aujourdhuiParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(maintenant);
}

/** Ajoute des jours à une date « AAAA-MM-JJ » (calcul en UTC, sans fuseau). */
function decaler(jour: string, jours: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Date à laquelle le rappel part : échéance moins l'anticipation. */
export function dateDeclenchement(rappelLe: string, avanceJours: number | null | undefined): string {
  return decaler(rappelLe, -(avanceJours ?? 0));
}

/** Vrai si le rappel programmé doit partir aujourd'hui (ou a été manqué). */
export function estDu(t: RappelTicket, aujourdhui: string): boolean {
  return estRappelProgramme(t) && dateDeclenchement(t.rappel_le!, t.rappel_avance_jours) <= aujourdhui;
}

/**
 * Échéance suivante d'un rappel annuel : même jour l'année d'après
 * (29 février → 28 février), jamais dans le passé.
 */
export function echeanceSuivante(rappelLe: string, aujourdhui: string): string {
  const [a, m, j] = rappelLe.split("-").map(Number);
  let annee = a + 1;
  const date = (y: number) => {
    const dernier = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(j, dernier)).padStart(2, "0")}`;
  };
  while (date(annee) < aujourdhui) annee += 1;
  return date(annee);
}

export interface SaisieRappel {
  titre: string;
  description: string | null;
  rappel_le: string;
  avance_jours: number;
  repetition: Repetition;
}

/** Contrôle la saisie d'un rappel ; lève une erreur lisible sinon. */
export function validerRappel(b: Record<string, unknown>, aujourdhui: string): SaisieRappel {
  const titre = typeof b.titre === "string" ? b.titre.trim().replace(/\s+/g, " ") : "";
  if (titre.length < 3 || titre.length > 160) throw new Error("Titre : 3 à 160 caractères");
  const date = typeof b.rappel_le === "string" ? b.rappel_le : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    throw new Error("Date d'échéance invalide");
  }
  if (date < aujourdhui) throw new Error("La date d'échéance est déjà passée");
  if (date > decaler(aujourdhui, 366 * 20)) throw new Error("Échéance trop lointaine (20 ans au maximum)");
  const avance = Number(b.avance_jours ?? 0);
  if (!AVANCES.some((a) => a.jours === avance)) throw new Error("Anticipation inconnue");
  const repetition = (b.repetition ?? "aucune") as Repetition;
  if (repetition !== "aucune" && repetition !== "annuelle") throw new Error("Répétition inconnue");
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 4000) : null;
  return { titre, description, rappel_le: date, avance_jours: avance, repetition };
}

/** « 15 août 2028 ». */
export function formatJour(jour: string): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .replace(/^1 /, "1er ");
}

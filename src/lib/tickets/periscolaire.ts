// ═══════════════════════════════════════════════════════════════
// Périscolaire (lot 5) — logique pure.
// ═══════════════════════════════════════════════════════════════

import { fonctionDe, type Fonction } from "./droits";
import type { CategorieTicket } from "./categories";

export type Creneau = "matin" | "midi" | "soir" | "mercredi" | "vacances";
export const CRENEAUX: Array<{ valeur: Creneau; libelle: string }> = [
  { valeur: "matin", libelle: "Matin" },
  { valeur: "midi", libelle: "Midi" },
  { valeur: "soir", libelle: "Soir" },
  { valeur: "mercredi", libelle: "Mercredi" },
  { valeur: "vacances", libelle: "Vacances" },
];
export const CRENEAU_LABELS = Object.fromEntries(CRENEAUX.map((c) => [c.valeur, c.libelle])) as Record<Creneau, string>;

export type TypeSite = "ecole" | "accueil_loisirs" | "restauration" | "batiment" | "autre";
export const TYPES_SITE: Array<{ valeur: TypeSite; libelle: string }> = [
  { valeur: "ecole", libelle: "École" },
  { valeur: "accueil_loisirs", libelle: "Accueil de loisirs" },
  { valeur: "restauration", libelle: "Restaurant scolaire" },
  { valeur: "batiment", libelle: "Autre bâtiment" },
  { valeur: "autre", libelle: "Autre" },
];

export interface PrecisionsPeriscolaire {
  site_id: string | null;
  creneau: Creneau | null;
  enfant: string | null;
  famille_informee: boolean | null;
}

/** Vrai si la catégorie (ou sa catégorie parente) est « Périscolaire & scolaire ». */
export function estPeriscolaire(
  categorieId: string | null | undefined, cats: Array<Pick<CategorieTicket, "id" | "parent_id" | "code">>,
): boolean {
  const c = categorieId ? cats.find((x) => x.id === categorieId) : null;
  if (!c) return false;
  const racine = c.parent_id ? cats.find((x) => x.id === c.parent_id) : c;
  return racine?.code === "periscolaire";
}

/** Contrôle des précisions saisies ; renvoie la forme à enregistrer. */
export function validerPeriscolaire(p: Partial<Record<keyof PrecisionsPeriscolaire, unknown>> | null | undefined): PrecisionsPeriscolaire {
  const enfantBrut = typeof p?.enfant === "string" ? p.enfant.trim().replace(/\s+/g, " ") : "";
  if (enfantBrut.length > 80) throw new Error("Enfant concerné : 80 caractères au maximum (prénom et initiale suffisent)");
  const creneau = p?.creneau;
  if (creneau !== undefined && creneau !== null && !CRENEAUX.some((c) => c.valeur === creneau)) throw new Error("Créneau inconnu");
  const famille = p?.famille_informee;
  if (famille !== undefined && famille !== null && typeof famille !== "boolean") throw new Error("Famille informée : oui ou non");
  return {
    site_id: typeof p?.site_id === "string" && p.site_id ? p.site_id : null,
    creneau: (creneau as Creneau | null | undefined) ?? null,
    enfant: enfantBrut || null,
    famille_informee: (famille as boolean | null | undefined) ?? null,
  };
}

/** Année et mois (1-12) d'une date, à l'heure de Paris. */
function anneeMoisParis(d: Date): { annee: number; mois: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).formatToParts(d);
  return { annee: Number(parts.find((x) => x.type === "year")!.value), mois: Number(parts.find((x) => x.type === "month")!.value) };
}

/**
 * Date d'effacement du champ « enfant » (miroir de
 * `date_effacement_enfant`, migration 061) : le 31 août qui suit la
 * clôture (fin de l'année scolaire en cours), ou `mois` après la
 * clôture si la commune l'a réglé. Rendue en « AAAA-MM-JJ » (Paris).
 */
export function dateEffacementEnfant(closLe: string | null, mois: number | null): string | null {
  if (!closLe) return null;
  const d = new Date(closLe);
  if (mois) {
    const f = new Date(d);
    f.setMonth(f.getMonth() + mois);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(f);
  }
  const { annee, mois: m } = anneeMoisParis(d);
  return `${m >= 9 ? annee + 1 : annee}-08-31`;
}

/**
 * Remontée automatique : personnes à nommer destinataires d'après les
 * fonctions prévues par la catégorie (sous-catégorie, sinon catégorie).
 */
export function destinatairesAuto(
  categorieId: string | null | undefined,
  cats: Array<Pick<CategorieTicket, "id" | "parent_id" | "notifier_fonctions">>,
  profils: Array<{ id: string; job_title: string | null; role?: string | null }>,
): string[] {
  const fonctions = fonctionsANotifier(categorieId, cats);
  if (fonctions.length === 0) return [];
  return profils
    .filter((p) => (p.role === undefined || p.role === "admin" || p.role === "editor") && fonctions.includes(fonctionDe(p.job_title)))
    .map((p) => p.id);
}

/** Fonctions à prévenir : réglage de la sous-catégorie, sinon de la catégorie. */
export function fonctionsANotifier(
  categorieId: string | null | undefined,
  cats: Array<Pick<CategorieTicket, "id" | "parent_id" | "notifier_fonctions">>,
): Fonction[] {
  const c = categorieId ? cats.find((x) => x.id === categorieId) : null;
  if (!c) return [];
  const parent = c.parent_id ? cats.find((x) => x.id === c.parent_id) : null;
  return ((c.notifier_fonctions && c.notifier_fonctions.length > 0 ? c.notifier_fonctions : parent?.notifier_fonctions) ?? []) as Fonction[];
}

/** Lieu saisi dans les paramètres (création ou modification). */
export function lireSite(b: unknown): { nom: string; type: TypeSite; adresse: string | null } {
  const o = (b ?? {}) as Record<string, unknown>;
  const nom = typeof o.nom === "string" ? o.nom.trim().replace(/\s+/g, " ") : "";
  if (nom.length < 2 || nom.length > 120) throw new Error("Nom du lieu : 2 à 120 caractères");
  const type = (o.type ?? "ecole") as TypeSite;
  if (!TYPES_SITE.some((t) => t.valeur === type)) throw new Error("Type de lieu inconnu");
  const adresse = typeof o.adresse === "string" && o.adresse.trim() ? o.adresse.trim().slice(0, 200) : null;
  return { nom, type, adresse };
}

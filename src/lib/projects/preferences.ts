// ═══════════════════════════════════════════════════════════════
// Préférences d'affichage de la liste des projets, par utilisateur
// (profiles.preferences.projets_liste, migration 050). Lecture
// tolérante : toute valeur inconnue retombe sur le défaut.
// ═══════════════════════════════════════════════════════════════

import type { StatutProjet } from "./pilotage";
import type { TypeProjetCode } from "./types";

/** « Ouverts » = en cours + terminés non clôturés (vue par défaut). */
export type FiltreStatutListe = "ouverts" | "en_cours" | "termine" | "cloture" | "tous";

export interface PreferencesListeProjets {
  statut: FiltreStatutListe;
  types: TypeProjetCode[];
  commissions: string[];
}

export const CLE_PREFS_LISTE = "projets_liste";

export const PREFS_LISTE_DEFAUT: PreferencesListeProjets = { statut: "ouverts", types: [], commissions: [] };

export const FILTRES_STATUT: Array<[FiltreStatutListe, string]> = [
  ["ouverts", "Ouverts"],
  ["en_cours", "En cours"],
  ["termine", "Terminés"],
  ["cloture", "Clôturés"],
  ["tous", "Tous"],
];

const STATUTS = new Set<FiltreStatutListe>(FILTRES_STATUT.map(([v]) => v));
const TYPES = new Set<TypeProjetCode>(["investissement", "evenementiel", "suivi_simple"]);
const ID_RE = /^[0-9a-f-]{36}$/i;

export function lirePreferencesListe(raw: unknown): PreferencesListeProjets {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const statut = STATUTS.has(o.statut as FiltreStatutListe) ? (o.statut as FiltreStatutListe) : PREFS_LISTE_DEFAUT.statut;
  const types = Array.isArray(o.types) ? [...new Set(o.types.filter((t): t is TypeProjetCode => TYPES.has(t as TypeProjetCode)))] : [];
  const commissions = Array.isArray(o.commissions)
    ? [...new Set(o.commissions.filter((c): c is string => typeof c === "string" && ID_RE.test(c)))].slice(0, 50)
    : [];
  return { statut, types, commissions };
}

export function correspondStatut(filtre: FiltreStatutListe, statut: StatutProjet): boolean {
  switch (filtre) {
    case "tous": return true;
    case "ouverts": return statut !== "cloture";
    default: return statut === filtre;
  }
}

export const prefsEgales = (a: PreferencesListeProjets, b: PreferencesListeProjets) =>
  a.statut === b.statut &&
  [...a.types].sort().join() === [...b.types].sort().join() &&
  [...a.commissions].sort().join() === [...b.commissions].sort().join();

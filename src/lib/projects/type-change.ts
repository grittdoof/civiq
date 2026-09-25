// ═══════════════════════════════════════════════════════════════
// Changement de type d'un projet (brief §2.2) — règle pure.
//
//   suivi_simple → investissement | evenementiel : toujours possible.
//   investissement → suivi_simple : refusé s'il existe des lignes
//     budgétaires, des devis ou des subventions (proposer l'archivage).
//   evenementiel ↔ investissement : possible, avec avertissement
//     (bascule fonctionnement / investissement du budget).
//
// Les messages suivent la doctrine : constat → conséquence → action.
// ═══════════════════════════════════════════════════════════════

import type { TypeProjetCode } from "./types";

export interface Alerte {
  constat: string;
  consequence: string;
  actions: string[];
}

export interface DonneesFinancieres {
  lignes_budget: number;
  devis: number;
  subventions: number;
}

export type TypeChangeDecision =
  | { ok: true; avertissement: Alerte | null }
  | { ok: false; alerte: Alerte };

export function decideTypeChange(
  from: TypeProjetCode,
  to: TypeProjetCode,
  donnees: DonneesFinancieres,
): TypeChangeDecision {
  if (from === to) return { ok: true, avertissement: null };

  if (to === "suivi_simple" && from !== "suivi_simple") {
    const total = donnees.lignes_budget + donnees.devis + donnees.subventions;
    if (total > 0) {
      const parts = [
        donnees.lignes_budget ? `${donnees.lignes_budget} ligne${donnees.lignes_budget > 1 ? "s" : ""} de budget` : null,
        donnees.devis ? `${donnees.devis} devis` : null,
        donnees.subventions ? `${donnees.subventions} demande${donnees.subventions > 1 ? "s" : ""} de subvention` : null,
      ].filter(Boolean);
      return {
        ok: false,
        alerte: {
          constat: `Ce projet contient déjà ${parts.join(", ")}.`,
          consequence:
            "Un suivi simple n'affiche ni budget, ni devis, ni financeurs : ces informations deviendraient invisibles.",
          actions: [
            "Gardez le type actuel.",
            "Ou archivez ce projet si le dossier est terminé ou abandonné : rien ne sera perdu.",
          ],
        },
      };
    }
    return { ok: true, avertissement: null };
  }

  if ((from === "evenementiel" && to === "investissement") || (from === "investissement" && to === "evenementiel")) {
    return {
      ok: true,
      avertissement: {
        constat:
          to === "investissement"
            ? "Un événement est payé sur le budget de fonctionnement ; un investissement, sur le budget d'investissement."
            : "Un investissement est payé sur le budget d'investissement ; un événement, sur le budget de fonctionnement.",
        consequence:
          "Les montants déjà saisis ne changent pas de section automatiquement : ils peuvent ne plus correspondre à la bonne ligne du budget communal.",
        actions: ["Vérifiez le budget du projet après le changement, avec la secrétaire de mairie si besoin."],
      },
    };
  }

  // suivi_simple → autre : toujours possible, blocs ajoutés vides.
  return { ok: true, avertissement: null };
}

/** Ce qui apparaît quand un suivi simple « prend de l'ampleur ». */
export const APERCU_PROMOTION: Record<Exclude<TypeProjetCode, "suivi_simple">, string[]> = {
  investissement: [
    "Les étapes types d'un investissement (estimation, délibération, subventions, devis, travaux…), que vous pourrez décocher",
    "Un onglet Budget, pour le coût du projet hors taxes",
    "Un onglet Devis, pour comparer les entreprises",
    "Un onglet Financeurs, pour suivre les subventions",
  ],
  evenementiel: [
    "Un rétroplanning calculé à rebours de la date de l'événement",
    "Un budget simple : dépenses, recettes et solde",
    "Un onglet Partenaires (associations, prestataires)",
  ],
};

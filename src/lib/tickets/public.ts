// ═══════════════════════════════════════════════════════════════
// Page publique des interventions (lot 4 bis) — logique pure.
// Uniquement des chiffres agrégés : aucun titre, adresse, nom ni
// description ne sort d'ici. Tickets « standard » des thèmes publiés.
// ═══════════════════════════════════════════════════════════════

import type { CategorieTicket } from "./categories";

/** Thèmes non publiés par défaut (sensibles ou internes). */
export const NON_PUBLIES_PAR_DEFAUT = ["periscolaire", "securite", "administratif", "informatique", "autre"];

/** Catégories racines publiées : choix de la commune, sinon défaut. */
export function themesPublies(racines: CategorieTicket[], choix: string[] | null): CategorieTicket[] {
  const actives = racines.filter((r) => !r.parent_id && r.actif);
  if (choix) return actives.filter((r) => choix.includes(r.id));
  return actives.filter((r) => !NON_PUBLIES_PAR_DEFAUT.includes(r.code));
}

export type PeriodePublique = "30j" | "12m";

export interface TicketPublic {
  racine_id: string;
  statut: string;
  created_at: string;
  pris_en_charge_at: string | null;
  termine_le: string | null;
}

export interface AgregatsPublics {
  terminees: number;
  enCours: number;
  delaiMoyenJours: number | null;
  priseEnCharge48h: number | null;
  parTheme: Array<{ id: string; libelle: string; terminees: number; enCours: number; delaiMoyenJours: number | null }>;
  parMois: Array<{ cle: string; libelle: string; terminees: number }>;
}

const OUVERTS = new Set(["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"]);
const TERMINES = new Set(["resolu", "clos"]);
const ms = (iso: string) => new Date(iso).getTime();

function delaiMoyen(liste: TicketPublic[]): number | null {
  const d = liste.filter((t) => t.termine_le).map((t) => ms(t.termine_le!) - ms(t.created_at)).filter((x) => x >= 0);
  return d.length === 0 ? null : Math.round((d.reduce((a, b) => a + b, 0) / d.length / 86_400_000) * 10) / 10;
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function agregatsPublics(
  tickets: TicketPublic[], themes: CategorieTicket[], periode: PeriodePublique, maintenant = new Date(),
): AgregatsPublics {
  const ids = new Set(themes.map((t) => t.id));
  const publics = tickets.filter((t) => ids.has(t.racine_id));
  const debut = periode === "30j"
    ? maintenant.getTime() - 30 * 86_400_000
    : new Date(maintenant.getFullYear() - 1, maintenant.getMonth(), maintenant.getDate()).getTime();
  const termineesPeriode = publics.filter((t) => TERMINES.has(t.statut) && t.termine_le && ms(t.termine_le) >= debut);
  const crees = publics.filter((t) => ms(t.created_at) >= debut);
  const pec48 = crees.filter((t) => t.pris_en_charge_at && ms(t.pris_en_charge_at) - ms(t.created_at) <= 2 * 86_400_000);

  // Six derniers mois (30 jours) ou douze (12 mois), le mois courant inclus
  const nbMois = periode === "30j" ? 6 : 12;
  const parMois = Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - (nbMois - 1 - i), 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      cle, libelle: MOIS[d.getMonth()],
      terminees: publics.filter((t) => TERMINES.has(t.statut) && t.termine_le?.slice(0, 7) === cle).length,
    };
  });

  return {
    terminees: termineesPeriode.length,
    enCours: publics.filter((t) => OUVERTS.has(t.statut)).length,
    delaiMoyenJours: delaiMoyen(termineesPeriode),
    priseEnCharge48h: crees.length === 0 ? null : Math.round((pec48.length / crees.length) * 100),
    parTheme: themes.map((th) => {
      const liste = publics.filter((t) => t.racine_id === th.id);
      const term = liste.filter((t) => TERMINES.has(t.statut) && t.termine_le && ms(t.termine_le) >= debut);
      return { id: th.id, libelle: th.libelle, terminees: term.length, enCours: liste.filter((t) => OUVERTS.has(t.statut)).length, delaiMoyenJours: delaiMoyen(term) };
    }).filter((x) => x.terminees + x.enCours > 0),
    parMois,
  };
}

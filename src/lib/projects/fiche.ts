// ═══════════════════════════════════════════════════════════════
// Fiche projet A4 (brief §2.13) — contenu commun au PDF et au Word.
//
// Deux variantes (§2.10) :
//   • complète      — usage interne : notes internes incluses, signalées ;
//   • communicable  — demandes CADA, conseillers municipaux : aucune note
//                     interne (commentaires ni pièces jointes).
// Un projet événementiel remplace le plan de financement par le budget
// de fonctionnement recettes / dépenses et le rétroplanning.
// ═══════════════════════════════════════════════════════════════

import { avancementAffiche, isEnRetard, sortEtapes, statutOf, ETAPE_STATUT_META } from "./etapes";
import { dateReporting } from "./pilotage";
import { calculerPlan, totauxBudget, type LigneBudget, type PlanFinancement, type Subvention } from "./financement";
import type { EtapePilotage } from "./pilotage";
import type { TypeProjetCode } from "./types";

export type VarianteFiche = "complete" | "communicable";

export const VARIANTE_LABEL: Record<VarianteFiche, string> = {
  complete: "Fiche complète (usage interne)",
  communicable: "Fiche communicable",
};

export const STATUT_SUBVENTION_LABEL: Record<Subvention["statut"], string> = {
  a_demander: "À demander",
  demandee: "Demandée",
  ar_recu: "Accusé de réception reçu",
  accordee: "Accordée",
  refusee: "Refusée",
  soldee: "Versée",
};

export interface FicheInput {
  variante: VarianteFiche;
  projet: {
    titre: string;
    type_code: TypeProjetCode | null;
    description: string | null;
    photo_url: string | null;
    confidentiel: boolean;
    avancement_pct: number | null;
    avancement_manuel_pct: number | null;
    evenement_debut?: string | null;
    lieu?: string | null;
    emprunt_prevu?: number | null;
    autofinancement_invest?: number | null;
    autofinancement_fonct?: number | null;
  };
  commission: string | null;
  referent: string | null;
  etapes: EtapePilotage[];
  lignes: LigneBudget[];
  subventions: Array<Subvention & { financeur: string; dispositif?: string | null }>;
  deliberations: Array<{ numero: string | null; date_seance: string | null; objet: string | null }>;
  documents: Array<{ nom: string; note_interne?: boolean | null }>;
  tauxFctva: number;
  now?: Date;
}

export interface FicheLigneEtape {
  libelle: string;
  date: string | null;
  statut: string;
  enRetard: boolean;
  jalon: boolean;
  commentaire: string | null;
  noteInterne: boolean;
}

export interface FicheData {
  variante: VarianteFiche;
  titre: string;
  type: TypeProjetCode;
  typeLabel: string;
  commission: string | null;
  referent: string | null;
  description: string | null;
  photoUrl: string | null;
  confidentiel: boolean;
  avancement: number | null;
  /** Jalons (investissement, suivi) ou rétroplanning complet (événement). */
  etapesTitre: string;
  etapes: FicheLigneEtape[];
  evenement: { date: string | null; lieu: string | null } | null;
  budget:
    | { kind: "investissement"; prevuHt: number; engageHt: number; mandateHt: number; plan: PlanFinancement }
    | { kind: "fonctionnement"; depensesTtc: number; recettesTtc: number; soldeTtc: number }
    | null;
  subventions: Array<{ financeur: string; statut: string; demande: number | null; obtenu: number | null }>;
  deliberations: Array<{ numero: string | null; date: string | null; objet: string | null }>;
  documents: Array<{ nom: string; noteInterne: boolean }>;
}

const TYPE_LABEL: Record<TypeProjetCode, string> = {
  investissement: "Investissement",
  evenementiel: "Événement",
  suivi_simple: "Suivi simple",
};

const MAX_ETAPES = 14;

function adapt(e: EtapePilotage) {
  return { statut: e.statut ?? undefined, fait: !!e.fait, echeance: e.echeance, date_previsionnelle: e.date_previsionnelle } as Parameters<typeof statutOf>[0];
}

export function construireFiche(input: FicheInput): FicheData {
  const now = input.now ?? new Date();
  const type = (input.projet.type_code ?? "suivi_simple") as TypeProjetCode;
  const complete = input.variante === "complete";
  const evenement = type === "evenementiel";

  // Événement : tout le rétroplanning ; sinon les jalons (à défaut, les étapes).
  const toutes = sortEtapes(input.etapes.map((e) => ({ ...e, ...adapt(e) }) as unknown as EtapePilotage & ReturnType<typeof adapt>));
  const jalons = toutes.filter((e) => e.est_un_jalon);
  // Chronologie : date réelle si terminée, sinon prévue ; sans date en dernier.
  const dateDe = (e: (typeof toutes)[number]) =>
    (statutOf(e) === "termine" ? e.date_reelle ?? e.date_previsionnelle : e.date_previsionnelle) ?? (e.echeance ? `${e.echeance}T00:00:00.000Z` : null);
  const choisies = [...(evenement || jalons.length === 0 ? toutes : jalons)]
    .sort((a, b) => (dateDe(a) ?? "9999").localeCompare(dateDe(b) ?? "9999"))
    .slice(0, MAX_ETAPES);

  const etapes: FicheLigneEtape[] = choisies.map((e) => {
    const statut = statutOf(e);
    const interne = !!e.commentaire_note_interne;
    const commentaire = e.commentaire && (complete || !interne) ? e.commentaire.trim() || null : null;
    return {
      libelle: e.libelle,
      date: dateReporting(dateDe(e)),
      statut: ETAPE_STATUT_META[statut].label,
      enRetard: isEnRetard(e, now),
      jalon: !!e.est_un_jalon,
      commentaire,
      noteInterne: interne && !!commentaire,
    };
  });

  let budget: FicheData["budget"] = null;
  if (type === "investissement") {
    const t = totauxBudget(input.lignes, "ht");
    const plan = calculerPlan({
      type,
      lignes: input.lignes,
      subventions: input.subventions,
      emprunt: input.projet.emprunt_prevu ?? null,
      autofinancement_invest: input.projet.autofinancement_invest ?? null,
      autofinancement_fonct: input.projet.autofinancement_fonct ?? null,
      taux_fctva: input.tauxFctva,
    });
    budget = { kind: "investissement", prevuHt: t.prevu, engageHt: t.engage, mandateHt: t.mandate, plan };
  } else if (evenement) {
    const t = totauxBudget(input.lignes, "ttc");
    const depenses = t.recettes - t.solde;
    budget = { kind: "fonctionnement", depensesTtc: Math.round(depenses * 100) / 100, recettesTtc: t.recettes, soldeTtc: t.solde };
  }

  return {
    variante: input.variante,
    titre: input.projet.titre,
    type,
    typeLabel: TYPE_LABEL[type],
    commission: input.commission,
    referent: input.referent,
    description: input.projet.description,
    photoUrl: input.projet.photo_url,
    confidentiel: input.projet.confidentiel,
    avancement: avancementAffiche(input.projet).pct,
    etapesTitre: evenement ? "Rétroplanning" : jalons.length ? "Calendrier des jalons" : "Étapes",
    etapes,
    evenement: evenement ? { date: dateReporting(input.projet.evenement_debut ?? null), lieu: input.projet.lieu ?? null } : null,
    budget,
    // Événement : pas de subventions d'investissement ni de ratios (critère d'acceptation).
    subventions: evenement
      ? []
      : input.subventions
          .filter((s) => s.statut !== "a_demander")
          .map((s) => ({
            financeur: [s.financeur, s.dispositif].filter(Boolean).join(" — "),
            statut: STATUT_SUBVENTION_LABEL[s.statut],
            demande: s.montant_demande === null ? null : Number(s.montant_demande),
            obtenu: s.montant_obtenu === null ? null : Number(s.montant_obtenu),
          })),
    deliberations: input.deliberations.map((d) => ({
      numero: d.numero,
      date: d.date_seance ? dateReporting(`${d.date_seance.slice(0, 10)}T00:00:00.000Z`) : null,
      objet: d.objet,
    })),
    documents: input.documents
      .filter((d) => complete || !d.note_interne)
      .map((d) => ({ nom: d.nom, noteInterne: !!d.note_interne })),
  };
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
/** Montant en euros, espaces insécables normales (compatibles polices PDF). */
export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return EUR.format(n).replace(/ /g, " ");
}
export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

export function nomFichier(titre: string, suffixe: string, ext: "pdf" | "docx"): string {
  const base = titre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "projet";
  return `${base}-${suffixe}.${ext}`;
}

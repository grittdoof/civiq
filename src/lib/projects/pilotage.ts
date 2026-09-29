// ═══════════════════════════════════════════════════════════════
// Pilotage du portefeuille (brief §2.12) — logique pure :
//   • statut d'un projet (en cours / terminé) et badges d'alerte ;
//   • statistiques (avancement, budget prévu / engagé / payé,
//     subventions sollicitées / accordées / encaissées) ;
//   • reporting en puces hiérarchisées sur trois niveaux.
//
// Aucune note interne ne sort dans le reporting ni les statistiques.
// ═══════════════════════════════════════════════════════════════

import { avancementAffiche, formatEtapeDate, isEnRetard, sortEtapes, statutOf } from "./etapes";
import { calculerPlan, subventionSansAr, totauxBudget, type LigneBudget, type Subvention } from "./financement";
import { montantReferenceMarche } from "./marches";
import type { EtapeStatut, TypeProjetCode } from "./types";

export interface EtapePilotage {
  id: string;
  project_id: string;
  libelle: string;
  statut: EtapeStatut | null;
  fait: boolean | null;
  echeance: string | null;
  date_previsionnelle: string | null;
  date_reelle: string | null;
  est_un_jalon: boolean | null;
  remonter_au_reporting: boolean | null;
  commentaire: string | null;
  commentaire_note_interne: boolean | null;
  ordre: number | null;
  created_at?: string;
}

export interface SubventionPilotage extends Subvention {
  project_id: string;
  date_demande: string | null;
  date_ar: string | null;
}

export interface ProjetPilotage {
  id: string;
  titre: string;
  type_code: TypeProjetCode | null;
  commission: { id: string; nom: string; color: string | null } | null;
  referent: { id: string; nom: string } | null;
  avancement_pct: number | null;
  avancement_manuel_pct: number | null;
  confidentiel: boolean;
  emprunt_prevu?: number | null;
  autofinancement_invest?: number | null;
  autofinancement_fonct?: number | null;
}

export type StatutProjet = "en_cours" | "termine";

export const STATUT_PROJET_LABEL: Record<StatutProjet, string> = { en_cours: "En cours", termine: "Terminé" };

const r2 = (n: number) => Math.round(n * 100) / 100;
const typeDe = (p: ProjetPilotage): TypeProjetCode => p.type_code ?? "suivi_simple";

/** Terminé : au moins une étape, et toutes terminées. */
export function statutProjet(etapes: EtapePilotage[]): StatutProjet {
  if (etapes.length === 0) return "en_cours";
  return etapes.every((e) => statutOf(adapt(e)) === "termine") ? "termine" : "en_cours";
}

function adapt(e: EtapePilotage) {
  return { statut: e.statut ?? undefined, fait: !!e.fait, echeance: e.echeance, date_previsionnelle: e.date_previsionnelle } as Parameters<typeof statutOf>[0];
}

// ─── Badges d'alerte de la liste ───

export interface AlertesProjet {
  retards: number;
  subventionsSansAr: number;
  partCommuneKo: boolean;
  delegationDepassee: boolean;
}

export function alertesProjet(input: {
  projet: ProjetPilotage;
  etapes: EtapePilotage[];
  lignes: LigneBudget[];
  subventions: SubventionPilotage[];
  devis: Array<{ montant_ht: number | null; statut: string; lot?: string | null }>;
  seuilDelegationHt: number | null;
  tauxFctva: number;
  now?: Date;
}): AlertesProjet {
  const now = input.now ?? new Date();
  const type = typeDe(input.projet);
  const retards = input.etapes.filter((e) => isEnRetard(adapt(e), now)).length;
  const subventionsSansAr = input.subventions.filter((s) => subventionSansAr(s, now)).length;
  let partCommuneKo = false;
  let delegationDepassee = false;
  if (type === "investissement") {
    const plan = calculerPlan({
      type,
      lignes: input.lignes,
      subventions: input.subventions,
      emprunt: input.projet.emprunt_prevu ?? null,
      autofinancement_invest: input.projet.autofinancement_invest ?? null,
      autofinancement_fonct: input.projet.autofinancement_fonct ?? null,
      taux_fctva: input.tauxFctva,
    });
    partCommuneKo = plan.controle_part_commune_ok === false;
  }
  // Même règle que l'alerte « délégation » de marches.ts : silence si le
  // paramètre n'est pas renseigné, et jamais pour un événement.
  if (type !== "evenementiel" && input.seuilDelegationHt !== null) {
    const ref = montantReferenceMarche(input.devis, type === "investissement" ? totauxBudget(input.lignes, "ht").prevu : null);
    delegationDepassee = ref.montant !== null && ref.montant > input.seuilDelegationHt;
  }
  return { retards, subventionsSansAr, partCommuneKo, delegationDepassee };
}

// ─── Statistiques ───

export interface LigneCommission {
  id: string | null;
  nom: string;
  color: string | null;
  nbProjets: number;
  avancement: number | null;
  nbAvancementRenseigne: number;
  prevuHt: number;
  engageHt: number;
  mandateHt: number;
}

export interface Statistiques {
  nbProjets: number;
  avancementGeneral: number | null;
  nbAvancementRenseigne: number;
  parCommission: LigneCommission[];
  budget: { prevuHt: number; engageHt: number; mandateHt: number };
  subventions: { sollicitees: number; accordees: number; encaissees: number };
}

const DEPOSEES = ["demandee", "ar_recu", "accordee", "soldee"];

export function calculerStatistiques(input: {
  projets: ProjetPilotage[];
  lignesParProjet: Map<string, LigneBudget[]>;
  subventionsParProjet: Map<string, SubventionPilotage[]>;
}): Statistiques {
  const groupes = new Map<string, LigneCommission & { somme: number }>();
  let somme = 0, nbRens = 0;
  const budget = { prevuHt: 0, engageHt: 0, mandateHt: 0 };
  const subventions = { sollicitees: 0, accordees: 0, encaissees: 0 };

  for (const p of input.projets) {
    const key = p.commission?.id ?? "__sans__";
    const g = groupes.get(key) ?? {
      id: p.commission?.id ?? null, nom: p.commission?.nom ?? "Sans commission", color: p.commission?.color ?? null,
      nbProjets: 0, avancement: null, nbAvancementRenseigne: 0, prevuHt: 0, engageHt: 0, mandateHt: 0, somme: 0,
    };
    g.nbProjets++;
    const a = avancementAffiche(p).pct;
    if (a !== null) { g.somme += a; g.nbAvancementRenseigne++; somme += a; nbRens++; }
    const t = totauxBudget(input.lignesParProjet.get(p.id) ?? [], "ht");
    g.prevuHt += t.prevu; g.engageHt += t.engage; g.mandateHt += t.mandate;
    budget.prevuHt += t.prevu; budget.engageHt += t.engage; budget.mandateHt += t.mandate;
    for (const s of input.subventionsParProjet.get(p.id) ?? []) {
      const dem = Number(s.montant_demande ?? 0);
      const obt = Number(s.montant_obtenu ?? s.montant_demande ?? 0);
      if (DEPOSEES.includes(s.statut)) subventions.sollicitees += dem;
      if (s.statut === "accordee" || s.statut === "soldee") subventions.accordees += obt;
      if (s.statut === "soldee") subventions.encaissees += obt;
    }
    groupes.set(key, g);
  }

  const parCommission = [...groupes.values()]
    .map(({ somme: s, ...g }) => ({
      ...g,
      avancement: g.nbAvancementRenseigne ? Math.round(s / g.nbAvancementRenseigne) : null,
      prevuHt: r2(g.prevuHt), engageHt: r2(g.engageHt), mandateHt: r2(g.mandateHt),
    }))
    .sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : a.nom.localeCompare(b.nom, "fr")));

  return {
    nbProjets: input.projets.length,
    avancementGeneral: nbRens ? Math.round(somme / nbRens) : null,
    nbAvancementRenseigne: nbRens,
    parCommission,
    budget: { prevuHt: r2(budget.prevuHt), engageHt: r2(budget.engageHt), mandateHt: r2(budget.mandateHt) },
    subventions: { sollicitees: r2(subventions.sollicitees), accordees: r2(subventions.accordees), encaissees: r2(subventions.encaissees) },
  };
}

// ─── Reporting : puces hiérarchisées (• projet / ◦ étape / ▪ détail) ───

export interface FiltresPilotage {
  commissionId?: string;
  type?: TypeProjetCode | "";
  statut?: StatutProjet | "";
}

export interface ReportingProjet {
  id: string;
  titre: string;
  type: TypeProjetCode;
  commission: string | null;
  lignes: Array<{ texte: string; sous: string[] }>;
}

export function filtrerProjets(projets: ProjetPilotage[], statuts: Map<string, StatutProjet>, f: FiltresPilotage): ProjetPilotage[] {
  return projets.filter((p) =>
    (!f.commissionId || (f.commissionId === "__sans__" ? !p.commission : p.commission?.id === f.commissionId)) &&
    (!f.type || typeDe(p) === f.type) &&
    (!f.statut || statuts.get(p.id) === f.statut),
  );
}

/** Détails de niveau 3 : lignes du commentaire, sans puce saisie à la main. */
export function detailsCommentaire(commentaire: string | null): string[] {
  if (!commentaire) return [];
  return commentaire
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-–•◦▪*·]\s*/, "").trim())
    .filter(Boolean);
}

/** « 31 juillet 2026, 11h » / « 1er septembre 2026 ». */
export function dateReporting(iso: string | null): string | null {
  const f = formatEtapeDate(iso);
  if (!f || !iso) return null;
  const d = new Date(iso);
  const jour = d.getUTCDate() === 1 ? f.replace(/^1 /, "1er ") : f;
  if (iso.includes("T00:00:00")) return jour;
  const m = d.getUTCMinutes();
  return jour.replace(/\s*(à\s*)?\d{2}:\d{2}$/, "") + `, ${d.getUTCHours()}h${m ? String(m).padStart(2, "0") : ""}`;
}

export function construireReporting(
  projets: ProjetPilotage[],
  etapesParProjet: Map<string, EtapePilotage[]>,
): ReportingProjet[] {
  const out: ReportingProjet[] = [];
  for (const p of projets) {
    type E = EtapePilotage & ReturnType<typeof adapt>;
    const etapes = sortEtapes(
      (etapesParProjet.get(p.id) ?? []).filter((e) => e.remonter_au_reporting).map((e) => ({ ...e, ...adapt(e) }) as unknown as E),
    );
    if (etapes.length === 0) continue;
    out.push({
      id: p.id,
      titre: p.titre,
      type: typeDe(p),
      commission: p.commission?.nom ?? null,
      lignes: etapes.map((e) => {
        const termine = statutOf(e) === "termine";
        const date = dateReporting(termine ? e.date_reelle ?? e.date_previsionnelle : e.date_previsionnelle ?? (e.echeance ? `${e.echeance}T00:00:00.000Z` : null));
        const texte = `${e.libelle}${date ? ` — ${termine ? "fait le " : ""}${date}` : ""}`;
        // Note interne : jamais dans un document de reporting.
        return { texte, sous: e.commentaire_note_interne ? [] : detailsCommentaire(e.commentaire) };
      }),
    });
  }
  return out.sort((a, b) => (a.commission ?? "~").localeCompare(b.commission ?? "~", "fr") || a.titre.localeCompare(b.titre, "fr"));
}

/** Texte brut à tabulation stricte (copier-coller dans un courriel). */
export function reportingEnTexte(items: ReportingProjet[]): string {
  return items
    .map((p) => [`• ${p.titre}`, ...p.lignes.flatMap((l) => [`    ◦ ${l.texte}`, ...l.sous.map((s) => `        ▪ ${s}`)])].join("\n"))
    .join("\n\n");
}

const TYPES_OK: TypeProjetCode[] = ["investissement", "evenementiel", "suivi_simple"];

/** Filtres lus dans l'URL (valeurs inconnues ignorées). */
export function lireFiltres(q: Record<string, string | undefined>): FiltresPilotage {
  const type = TYPES_OK.includes(q.type as TypeProjetCode) ? (q.type as TypeProjetCode) : "";
  const statut = q.statut === "en_cours" || q.statut === "termine" ? q.statut : "";
  const commissionId = q.commission && /^[\w-]{1,64}$/.test(q.commission) ? q.commission : undefined;
  return { commissionId, type, statut };
}

const TYPE_LIBELLE: Record<TypeProjetCode, string> = { investissement: "Investissements", evenementiel: "Événements", suivi_simple: "Suivis simples" };

/** « Commission Voirie · Investissements · En cours — au 29 septembre 2026 ». */
export function libelleFiltres(f: FiltresPilotage, commissions: Array<{ id: string; nom: string }>, date: string): string {
  const parts: string[] = [];
  if (f.commissionId) parts.push(f.commissionId === "__sans__" ? "Sans commission" : `Commission ${commissions.find((c) => c.id === f.commissionId)?.nom ?? ""}`.trim());
  if (f.type) parts.push(TYPE_LIBELLE[f.type]);
  if (f.statut) parts.push(STATUT_PROJET_LABEL[f.statut]);
  return `${parts.length ? parts.join(" · ") : "Tous les projets"} — au ${date}`;
}

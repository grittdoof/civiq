// ═══════════════════════════════════════════════════════════════
// Budget et plan de financement (brief §2.8) — logique pure.
//
// Miroir 1:1 de la fonction SQL project_financement() (migration 041),
// qui fait foi : ce module sert au recalcul instantané pendant la saisie
// et aux tests. Toute évolution doit être faite des deux côtés.
// ═══════════════════════════════════════════════════════════════

export type BudgetBase = "ht" | "ttc";
export type BudgetEtat = "previsionnel" | "engage" | "mandate";
export type BudgetSection = "investissement" | "fonctionnement";

export const BUDGET_ETAT_META: Record<BudgetEtat, { label: string; aide: string }> = {
  previsionnel: { label: "Prévu", aide: "Une estimation : rien n'est encore signé." },
  engage: { label: "Engagé", aide: "Le devis est signé, la dépense est certaine, même si la facture n'est pas encore payée." },
  mandate: { label: "Payé", aide: "La facture est payée (mandatée par la commune)." },
};

export interface LigneBudget {
  sens: "depense" | "recette";
  base: BudgetBase;
  taux_tva: number;
  etat: BudgetEtat;
  montant_prevu: number | null;
  montant_reel: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function versHt(montant: number, base: BudgetBase, tva: number): number {
  return base === "ht" ? montant : r2(montant / (1 + tva / 100));
}
export function versTtc(montant: number, base: BudgetBase, tva: number): number {
  return base === "ttc" ? montant : r2(montant * (1 + tva / 100));
}

/** Montant retenu d'une ligne : le réel s'il est engagé/payé, sinon le prévu. */
function montantLigne(l: LigneBudget, cible: BudgetBase): number {
  const brut = l.etat === "previsionnel" ? l.montant_prevu : l.montant_reel ?? l.montant_prevu;
  if (brut === null || brut === undefined) return 0;
  return cible === "ht" ? versHt(Number(brut), l.base, Number(l.taux_tva)) : versTtc(Number(brut), l.base, Number(l.taux_tva));
}

export interface TotauxBudget {
  prevu: number;
  engage: number;
  mandate: number;
  recettes: number;
  solde: number;
}

/** Totaux dans une base (HT pour un investissement, TTC pour un événement). */
export function totauxBudget(lignes: LigneBudget[], cible: BudgetBase): TotauxBudget {
  let prevu = 0, engage = 0, mandate = 0, recettes = 0;
  for (const l of lignes) {
    const conv = (m: number | null) => (m === null ? 0 : cible === "ht" ? versHt(Number(m), l.base, Number(l.taux_tva)) : versTtc(Number(m), l.base, Number(l.taux_tva)));
    if (l.sens === "recette") { recettes += montantLigne(l, cible); continue; }
    prevu += conv(l.montant_prevu);
    if (l.etat !== "previsionnel") engage += conv(l.montant_reel ?? l.montant_prevu);
    if (l.etat === "mandate") mandate += conv(l.montant_reel ?? l.montant_prevu);
  }
  const depenses = lignes.filter((l) => l.sens === "depense").reduce((s, l) => s + montantLigne(l, cible), 0);
  return { prevu: r2(prevu), engage: r2(engage), mandate: r2(mandate), recettes: r2(recettes), solde: r2(recettes - depenses) };
}

export interface Subvention {
  statut: "a_demander" | "demandee" | "ar_recu" | "accordee" | "refusee" | "soldee";
  montant_demande: number | null;
  montant_obtenu: number | null;
}

export interface PlanFinancement {
  cout_total_ht: number;
  cout_total_ttc: number;
  engage_ht: number;
  subventions_sollicitees: number;
  subventions_accordees: number;
  aides_retenues: number;
  emprunt: number;
  fctva: number;
  taux_fctva: number;
  autofinancement_invest: number;
  autofinancement_fonct: number;
  reste_a_financer: number;
  part_commune_ht: number;
  part_commune_pct: number | null;
  aides_pct: number | null;
  controle_part_commune_ok: boolean | null;
  part_commune_manquante: number | null;
  controle_aides_ok: boolean | null;
  aides_depassement: number | null;
}

export function calculerPlan(input: {
  type: "investissement" | "evenementiel" | "suivi_simple";
  lignes: LigneBudget[];
  subventions: Subvention[];
  emprunt: number | null;
  autofinancement_invest: number | null;
  autofinancement_fonct: number | null;
  taux_fctva: number;
}): PlanFinancement {
  const dep = input.lignes.filter((l) => l.sens === "depense");
  const cout_ht = r2(dep.reduce((s, l) => s + montantLigne(l, "ht"), 0));
  const cout_ttc = r2(dep.reduce((s, l) => s + montantLigne(l, "ttc"), 0));
  const engage_ht = r2(
    dep.filter((l) => l.etat !== "previsionnel").reduce((s, l) => s + versHt(Number(l.montant_reel ?? l.montant_prevu ?? 0), l.base, Number(l.taux_tva)), 0),
  );
  let sollicite = 0, accorde = 0, aides = 0;
  for (const s of input.subventions) {
    const dem = Number(s.montant_demande ?? 0);
    const obt = Number(s.montant_obtenu ?? s.montant_demande ?? 0);
    if (["demandee", "ar_recu", "accordee", "soldee"].includes(s.statut)) sollicite += dem;
    if (["accordee", "soldee"].includes(s.statut)) { accorde += obt; aides += obt; }
    else if (["demandee", "ar_recu"].includes(s.statut)) aides += dem;
  }
  const emprunt = Number(input.emprunt ?? 0);
  const afi = Number(input.autofinancement_invest ?? 0);
  const aff = Number(input.autofinancement_fonct ?? 0);
  const fctva = input.type === "investissement" ? r2((cout_ttc * input.taux_fctva) / 100) : 0;
  const part = r2(cout_ht - aides);
  const has = cout_ht > 0;
  return {
    cout_total_ht: cout_ht,
    cout_total_ttc: cout_ttc,
    engage_ht,
    subventions_sollicitees: r2(sollicite),
    subventions_accordees: r2(accorde),
    aides_retenues: r2(aides),
    emprunt,
    fctva,
    taux_fctva: input.taux_fctva,
    autofinancement_invest: afi,
    autofinancement_fonct: aff,
    reste_a_financer: r2(cout_ttc - aides - fctva - emprunt - afi - aff),
    part_commune_ht: part,
    part_commune_pct: has ? r2((100 * part) / cout_ht) : null,
    aides_pct: has ? r2((100 * aides) / cout_ht) : null,
    controle_part_commune_ok: has ? part >= 0.2 * cout_ht : null,
    part_commune_manquante: has ? Math.max(0, r2(0.2 * cout_ht - part)) : null,
    controle_aides_ok: has ? aides <= 0.8 * cout_ht : null,
    aides_depassement: has ? Math.max(0, r2(aides - 0.8 * cout_ht)) : null,
  };
}

/** Consommation budgétaire (jauge) : engagé / prévu, en %. null si pas de budget. */
export function consommationBudget(t: TotauxBudget): number | null {
  if (!(t.prevu > 0)) return null;
  return Math.round((100 * t.engage) / t.prevu);
}

/** Subvention déposée sans accusé de réception depuis plus de `jours` jours. */
export function subventionSansAr(
  s: { statut: string; date_demande: string | null; date_ar: string | null },
  now: Date = new Date(),
  jours = 21,
): boolean {
  if (s.statut !== "demandee" || s.date_ar || !s.date_demande) return false;
  const depot = Date.parse(`${s.date_demande.slice(0, 10)}T00:00:00Z`);
  return now.getTime() - depot > jours * 24 * 60 * 60 * 1000;
}

/** Message (doctrine) du refus de démarrage des travaux sans accusé de réception. */
export const ALERTE_COMMENCEMENT = {
  constat: "Aucune demande de subvention n'a d'accusé de réception enregistré.",
  consequence:
    "Si les travaux démarrent avant que le financeur ait accusé réception de votre demande, la subvention est définitivement perdue, sans recours possible.",
  actions: [
    "Déposez votre demande, puis enregistrez ici la date de l'accusé de réception (onglet Financeurs).",
    "Ou cochez « projet autofinancé » si la commune renonce volontairement à toute aide.",
  ],
};
export const ALERTE_COMMENCEMENT_SAVOIR = [
  "Engager une dépense ou démarrer des travaux avant la réception de la demande par le financeur fait perdre le bénéfice de l'aide : c'est la règle du « commencement d'exécution », commune à la plupart des financeurs publics (État, Région, Département).",
];

/** Le refus vient-il du verrou SQL du commencement d'exécution ? */
export function isErreurCommencement(message: string | null | undefined): boolean {
  return !!message && message.includes("COMMENCEMENT_SANS_ACCUSE_RECEPTION");
}

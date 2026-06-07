// ═══════════════════════════════════════════════════════════════
// Calcul du coût global d'un projet — pur, sans I/O.
//
// Miroir 1:1 de la fonction SQL public.project_global_cost(uuid).
// Sert pour l'UI (rendu immédiat des montants à la saisie) et le
// PDF (rendu serveur cohérent).
//
// Formules :
//   • Coûts saisis en euros constants (valeur d'aujourd'hui).
//   • Montant nominal de l'année n
//        = constant_n × (1 + inflation)^(n−1)
//     → inflation appliquée à partir de l'année 2.
//   • Valeur actualisée de l'année n
//        = nominal_n / (1 + taux_actualisation)^n
//     → actualisation appliquée dès l'année 1.
//   • Coût global nominal   = investissement + Σ nominal_n
//   • Coût global actualisé = investissement + Σ actualisé_n
// ═══════════════════════════════════════════════════════════════

export interface LifecycleCostRow {
  annee: number;                // 1..10
  cout_fonctionnement: number;
  cout_entretien: number;
}

export interface RatesInput {
  /** Taux d'inflation en % par an (ex: 2 = 2%) */
  taux_inflation: number;
  /** Taux d'actualisation en % par an (ex: 4 = 4%) */
  taux_actualisation: number;
}

export interface CostInput {
  budget_estime: number;
  lifecycle: LifecycleCostRow[];
  rates: RatesInput;
}

export interface YearBreakdown {
  annee: number;
  constant: number;
  nominal: number;
  actualise: number;
}

export interface GlobalCost {
  invest: number;
  total_nominal: number;
  total_actualise: number;
  taux_inflation_used: number;     // en %
  taux_actualisation_used: number; // en %
  /** Détail année par année (utile pour le PDF et les graphes) */
  breakdown: YearBreakdown[];
}

export const DEFAULT_TAUX_INFLATION = 2.0;
export const DEFAULT_TAUX_ACTUALISATION = 4.0;

/**
 * Résout les taux à utiliser : override projet > commune_settings > defaults.
 * Toutes les valeurs sont exprimées en % (ex: 2 = 2%).
 */
export function resolveRates(input: {
  project: { taux_inflation: number | null; taux_actualisation: number | null };
  commune: { taux_inflation: number | null; taux_actualisation: number | null } | null;
}): RatesInput {
  return {
    taux_inflation:
      input.project.taux_inflation ??
      input.commune?.taux_inflation ??
      DEFAULT_TAUX_INFLATION,
    taux_actualisation:
      input.project.taux_actualisation ??
      input.commune?.taux_actualisation ??
      DEFAULT_TAUX_ACTUALISATION,
  };
}

/**
 * Calcule le coût global nominal et actualisé d'un projet.
 * Pur, sans accès BDD ni RPC.
 */
export function computeGlobalCost(input: CostInput): GlobalCost {
  const invest = sanitize(input.budget_estime);
  const inflation = sanitize(input.rates.taux_inflation) / 100;
  const actualisation = sanitize(input.rates.taux_actualisation) / 100;

  // Indexer par année pour gérer les trous (et garantir l'ordre)
  const byYear = new Map<number, LifecycleCostRow>();
  for (const row of input.lifecycle ?? []) {
    if (row.annee >= 1 && row.annee <= 10) {
      byYear.set(row.annee, row);
    }
  }

  const breakdown: YearBreakdown[] = [];
  let totalNominal = 0;
  let totalActualise = 0;

  for (const row of [...byYear.values()].sort((a, b) => a.annee - b.annee)) {
    const constant = sanitize(row.cout_fonctionnement) + sanitize(row.cout_entretien);
    const nominal = constant * Math.pow(1 + inflation, row.annee - 1);
    const actualise = nominal / Math.pow(1 + actualisation, row.annee);
    breakdown.push({ annee: row.annee, constant, nominal, actualise });
    totalNominal += nominal;
    totalActualise += actualise;
  }

  return {
    invest,
    total_nominal: invest + totalNominal,
    total_actualise: invest + totalActualise,
    taux_inflation_used: inflation * 100,
    taux_actualisation_used: actualisation * 100,
    breakdown,
  };
}

/**
 * Calcule l'écart bilan en valeur et en %. Renvoie null si pas de
 * coût réel saisi.
 */
export function computeEcart(
  budget_estime: number,
  cout_reel: number | null,
): { value: number; pct: number } | null {
  if (cout_reel === null || cout_reel === undefined) return null;
  const b = sanitize(budget_estime);
  const r = sanitize(cout_reel);
  const value = r - b;
  const pct = b === 0 ? 0 : (value / b) * 100;
  return { value, pct };
}

function sanitize(n: number | null | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return n;
}

// ─── Helpers de formatage ───

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EUR_PRECISE = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatEuros(n: number, precise = false): string {
  return precise ? EUR_PRECISE.format(n) : EUR.format(n);
}

export function formatPercent(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(n / 100);
}

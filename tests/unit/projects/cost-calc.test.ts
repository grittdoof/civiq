import { describe, it, expect } from "vitest";
import {
  computeGlobalCost,
  computeEcart,
  resolveRates,
  DEFAULT_TAUX_INFLATION,
  DEFAULT_TAUX_ACTUALISATION,
  type LifecycleCostRow,
} from "@/lib/projects/cost-calc";

// ═══════════════════════════════════════════════════════════════
// Tests du calcul de coût global
// ═══════════════════════════════════════════════════════════════

describe("resolveRates", () => {
  it("utilise les overrides projet en priorité", () => {
    const r = resolveRates({
      project: { taux_inflation: 3.5, taux_actualisation: 5 },
      commune: { taux_inflation: 2, taux_actualisation: 4 },
    });
    expect(r).toEqual({ taux_inflation: 3.5, taux_actualisation: 5 });
  });

  it("retombe sur commune_settings si projet null", () => {
    const r = resolveRates({
      project: { taux_inflation: null, taux_actualisation: null },
      commune: { taux_inflation: 2.5, taux_actualisation: 3.5 },
    });
    expect(r).toEqual({ taux_inflation: 2.5, taux_actualisation: 3.5 });
  });

  it("retombe sur defaults si commune null", () => {
    const r = resolveRates({
      project: { taux_inflation: null, taux_actualisation: null },
      commune: null,
    });
    expect(r.taux_inflation).toBe(DEFAULT_TAUX_INFLATION);
    expect(r.taux_actualisation).toBe(DEFAULT_TAUX_ACTUALISATION);
  });

  it("mélange : override partiel projet + commune", () => {
    const r = resolveRates({
      project: { taux_inflation: 3, taux_actualisation: null },
      commune: { taux_inflation: 2, taux_actualisation: 5 },
    });
    expect(r).toEqual({ taux_inflation: 3, taux_actualisation: 5 });
  });
});

describe("computeGlobalCost — cas dégénérés", () => {
  it("sans coûts d'exploitation : global = investissement", () => {
    const r = computeGlobalCost({
      budget_estime: 100_000,
      lifecycle: [],
      rates: { taux_inflation: 2, taux_actualisation: 4 },
    });
    expect(r.invest).toBe(100_000);
    expect(r.total_nominal).toBe(100_000);
    expect(r.total_actualise).toBe(100_000);
  });

  it("budget 0 + coûts : global = somme des coûts (in/actualisée)", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [{ annee: 1, cout_fonctionnement: 1000, cout_entretien: 0 }],
      rates: { taux_inflation: 0, taux_actualisation: 0 },
    });
    expect(r.total_nominal).toBe(1000);
    expect(r.total_actualise).toBe(1000);
  });

  it("taux à 0 : nominal = actualisé = somme des coûts constants + invest", () => {
    const lifecycle: LifecycleCostRow[] = Array.from({ length: 10 }, (_, i) => ({
      annee: i + 1,
      cout_fonctionnement: 5000,
      cout_entretien: 2000,
    }));
    const r = computeGlobalCost({
      budget_estime: 100_000,
      lifecycle,
      rates: { taux_inflation: 0, taux_actualisation: 0 },
    });
    // 10 ans × 7000 = 70 000
    expect(r.total_nominal).toBeCloseTo(170_000, 5);
    expect(r.total_actualise).toBeCloseTo(170_000, 5);
  });
});

describe("computeGlobalCost — formules", () => {
  it("inflation appliquée à partir de l'année 2 (année 1 = euros constants)", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [
        { annee: 1, cout_fonctionnement: 1000, cout_entretien: 0 },
        { annee: 2, cout_fonctionnement: 1000, cout_entretien: 0 },
      ],
      rates: { taux_inflation: 10, taux_actualisation: 0 },
    });
    // année 1 : 1000 × 1.10^0 = 1000
    // année 2 : 1000 × 1.10^1 = 1100
    // total nominal = 2100
    expect(r.total_nominal).toBeCloseTo(2100, 5);
    expect(r.breakdown[0].nominal).toBeCloseTo(1000, 5);
    expect(r.breakdown[1].nominal).toBeCloseTo(1100, 5);
  });

  it("actualisation appliquée dès l'année 1", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [{ annee: 1, cout_fonctionnement: 1000, cout_entretien: 0 }],
      rates: { taux_inflation: 0, taux_actualisation: 10 },
    });
    // nominal année 1 = 1000
    // actualisé année 1 = 1000 / 1.10 ≈ 909.0909
    expect(r.total_actualise).toBeCloseTo(909.0909, 3);
  });

  it("inflation = actualisation : actualisé constant chaque année", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [
        { annee: 1, cout_fonctionnement: 1000, cout_entretien: 0 },
        { annee: 2, cout_fonctionnement: 1000, cout_entretien: 0 },
        { annee: 3, cout_fonctionnement: 1000, cout_entretien: 0 },
      ],
      rates: { taux_inflation: 5, taux_actualisation: 5 },
    });
    // Quand inflation = actualisation, les facteurs s'annulent :
    // actualisé_n = (constant × 1.05^(n-1)) / 1.05^n = constant / 1.05
    // → chaque année vaut 1000 / 1.05 ≈ 952.381 en actualisé
    const perYear = 1000 / 1.05;
    expect(r.total_actualise).toBeCloseTo(perYear * 3, 5);
    expect(r.breakdown[0].actualise).toBeCloseTo(perYear, 5);
    expect(r.breakdown[1].actualise).toBeCloseTo(perYear, 5);
    expect(r.breakdown[2].actualise).toBeCloseTo(perYear, 5);
  });

  it("inflation + actualisation différentes", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [
        { annee: 1, cout_fonctionnement: 1000, cout_entretien: 0 },
        { annee: 2, cout_fonctionnement: 1000, cout_entretien: 0 },
      ],
      rates: { taux_inflation: 2, taux_actualisation: 4 },
    });
    // année 1 : nominal = 1000     , act = 1000 / 1.04   ≈ 961.538
    // année 2 : nominal = 1020     , act = 1020 / 1.04^2 ≈ 942.899
    const expected = 1000 / 1.04 + 1020 / Math.pow(1.04, 2);
    expect(r.total_actualise).toBeCloseTo(expected, 5);
  });

  it("breakdown contient une ligne par année saisie", () => {
    const r = computeGlobalCost({
      budget_estime: 50_000,
      lifecycle: [
        { annee: 1, cout_fonctionnement: 100, cout_entretien: 50 },
        { annee: 3, cout_fonctionnement: 200, cout_entretien: 0 },
      ],
      rates: { taux_inflation: 0, taux_actualisation: 0 },
    });
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown[0].annee).toBe(1);
    expect(r.breakdown[0].constant).toBe(150);
    expect(r.breakdown[1].annee).toBe(3);
    expect(r.breakdown[1].constant).toBe(200);
  });

  it("ignore les années hors plage 1..10", () => {
    const r = computeGlobalCost({
      budget_estime: 0,
      lifecycle: [
        { annee: 0, cout_fonctionnement: 999, cout_entretien: 0 },
        { annee: 11, cout_fonctionnement: 999, cout_entretien: 0 },
        { annee: 5, cout_fonctionnement: 100, cout_entretien: 0 },
      ],
      rates: { taux_inflation: 0, taux_actualisation: 0 },
    });
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0].annee).toBe(5);
  });

  it("démontre la pertinence du coût actualisé (un projet 'pas cher' peut peser cher)", () => {
    // Projet A : invest faible, exploitation très chère
    // Projet B : invest élevé, exploitation négligeable
    const a = computeGlobalCost({
      budget_estime: 50_000,
      lifecycle: Array.from({ length: 10 }, (_, i) => ({
        annee: i + 1,
        cout_fonctionnement: 80_000,
        cout_entretien: 10_000,
      })),
      rates: { taux_inflation: 2, taux_actualisation: 4 },
    });
    const b = computeGlobalCost({
      budget_estime: 600_000,
      lifecycle: Array.from({ length: 10 }, (_, i) => ({
        annee: i + 1,
        cout_fonctionnement: 1_000,
        cout_entretien: 500,
      })),
      rates: { taux_inflation: 2, taux_actualisation: 4 },
    });

    // A est moins cher à l'investissement…
    expect(a.invest).toBeLessThan(b.invest);
    // …mais beaucoup plus cher en coût global actualisé.
    expect(a.total_actualise).toBeGreaterThan(b.total_actualise);
  });
});

describe("computeEcart", () => {
  it("renvoie null si cout_reel non saisi", () => {
    expect(computeEcart(100_000, null)).toBeNull();
  });

  it("dépassement positif", () => {
    const e = computeEcart(100_000, 120_000);
    expect(e?.value).toBe(20_000);
    expect(e?.pct).toBe(20);
  });

  it("économie négative", () => {
    const e = computeEcart(100_000, 80_000);
    expect(e?.value).toBe(-20_000);
    expect(e?.pct).toBe(-20);
  });

  it("budget 0 : pct = 0 (évite division par zéro)", () => {
    const e = computeEcart(0, 1000);
    expect(e?.value).toBe(1000);
    expect(e?.pct).toBe(0);
  });
});

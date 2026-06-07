import { describe, it, expect } from "vitest";
import {
  decideTransition,
  nextPhase,
  previousPhase,
  type ProjectSnapshot,
  type UserContext,
} from "@/lib/projects/state-machine";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// Tests de la machine à états — couvre les règles non négociables
// de la fiche fonctionnelle :
//   • avance étape par étape
//   • saut bloqué sans force ; saut avec force OK pour admin
//   • recul OK avec commentaire, refus sans commentaire
//   • porte de financement (refus → ar_recu OK → sans_subvention OK)
//   • bilan obligatoire avant clôture
// ═══════════════════════════════════════════════════════════════

function baseProject(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    phase: "emergence",
    sans_subvention: false,
    cout_reel: null,
    explication_ecart: null,
    financings: [],
    stakeholders: [],
    ...overrides,
  };
}

const editor: UserContext = { role: "editor" };
const admin: UserContext = { role: "admin" };
const viewer: UserContext = { role: "viewer" };

describe("decideTransition — rôle", () => {
  it("refuse les viewers", () => {
    const d = decideTransition(baseProject(), "faisabilite", viewer);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/Permissions/i);
  });

  it("refuse l'absence de rôle", () => {
    const d = decideTransition(baseProject(), "faisabilite", { role: null });
    expect(d.ok).toBe(false);
  });
});

describe("decideTransition — avancement nominal", () => {
  it("accepte l'avance d'une étape pour un editor", () => {
    const d = decideTransition(baseProject(), "faisabilite", editor);
    expect(d.ok).toBe(true);
    expect(d.direction).toBe("forward");
    expect(d.warnings).toEqual([]);
  });

  it("refuse une transition vers la même phase", () => {
    const d = decideTransition(baseProject(), "emergence", editor);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/déjà à cette étape/);
  });
});

describe("decideTransition — saut d'étape", () => {
  it("refuse un saut sans force", () => {
    const d = decideTransition(baseProject(), "decision_budget", editor);
    expect(d.ok).toBe(false);
    expect(d.require_force).toBe(true);
  });

  it("refuse le saut même avec force pour un editor (rôle insuffisant)", () => {
    const d = decideTransition(baseProject(), "decision_budget", editor, {
      force: true,
      comment: "raison valable",
    });
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/administrateur/i);
  });

  it("accepte le saut pour un admin avec force + commentaire", () => {
    const d = decideTransition(baseProject(), "decision_budget", admin, {
      force: true,
      comment: "raison valable",
    });
    expect(d.ok).toBe(true);
  });

  it("refuse le saut admin si commentaire vide", () => {
    const d = decideTransition(baseProject(), "decision_budget", admin, {
      force: true,
      comment: "   ",
    });
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/commentaire/i);
  });
});

describe("decideTransition — recul", () => {
  it("accepte le recul avec commentaire", () => {
    const d = decideTransition(
      baseProject({ phase: "decision_budget" }),
      "faisabilite",
      editor,
      { comment: "Correction d'erreur" },
    );
    expect(d.ok).toBe(true);
    expect(d.direction).toBe("backward");
  });

  it("refuse le recul sans commentaire", () => {
    const d = decideTransition(
      baseProject({ phase: "decision_budget" }),
      "faisabilite",
      editor,
    );
    expect(d.ok).toBe(false);
    expect(d.require_comment).toBe(true);
  });
});

describe("decideTransition — PORTE DE FINANCEMENT", () => {
  // Le projet est en conception_marches et veut passer en realisation
  const ready = () => baseProject({ phase: "conception_marches" });

  it("REFUSE le passage en realisation sans subvention sécurisée et sans sans_subvention", () => {
    const d = decideTransition(ready(), "realisation", editor);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/accusé de réception/i);
    expect(d.reason).toMatch(/sans subvention/i);
  });

  it("REFUSE si subvention seulement « demandee » (pas d'AR)", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "demandee" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/accusé de réception/i);
  });

  it("ACCEPTE si au moins une subvention ar_recu", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "ar_recu" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
  });

  it("ACCEPTE si subvention accordée", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "accordee" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
  });

  it("ACCEPTE si sans_subvention=true", () => {
    const p = baseProject({ phase: "conception_marches", sans_subvention: true });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
  });

  it("la règle n'est pas contournée par force admin", () => {
    const p = baseProject({ phase: "decision_budget" });
    // saut decision_budget → realisation, admin force
    const d = decideTransition(p, "realisation", admin, {
      force: true,
      comment: "urgence",
    });
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/accusé de réception/i);
  });
});

describe("decideTransition — BILAN OBLIGATOIRE", () => {
  it("REFUSE l'entrée dans bilan_cloture sans cout_reel", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: null,
      explication_ecart: "tout bon",
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/bilan obligatoire/i);
  });

  it("REFUSE l'entrée dans bilan_cloture sans explication", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: 120000,
      explication_ecart: null,
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(false);
  });

  it("REFUSE si explication vide après trim", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: 120000,
      explication_ecart: "   ",
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(false);
  });

  it("ACCEPTE si cout_reel et explication renseignés", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: 120000,
      explication_ecart: "Léger dépassement dû à des fondations renforcées.",
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(true);
  });

  it("n'est pas contournée par force admin", () => {
    const p = baseProject({ phase: "conception_marches" });
    const d = decideTransition(p, "bilan_cloture", admin, {
      force: true,
      comment: "raison",
    });
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/bilan obligatoire/i);
  });
});

describe("decideTransition — warnings non bloquants", () => {
  it("warning à l'entrée de decision_budget si aucun rôle « decide »", () => {
    const p = baseProject({ phase: "faisabilite", stakeholders: [] });
    const d = decideTransition(p, "decision_budget", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.length).toBe(1);
    expect(d.warnings[0]).toMatch(/décide/i);
  });

  it("pas de warning si un « decide » est associé", () => {
    const p = baseProject({
      phase: "faisabilite",
      stakeholders: [{ role: "decide", type: "interne" }],
    });
    const d = decideTransition(p, "decision_budget", editor);
    expect(d.warnings.length).toBe(0);
  });

  it("warning à l'entrée de financement si aucun « financeur »", () => {
    const p = baseProject({
      phase: "decision_budget",
      stakeholders: [{ role: "decide", type: "interne" }],
    });
    const d = decideTransition(p, "financement", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.some((w) => /financeur/i.test(w))).toBe(true);
  });

  it("pas de warning si un type financeur est associé", () => {
    const p = baseProject({
      phase: "decision_budget",
      stakeholders: [{ role: "consulte", type: "financeur" }],
    });
    const d = decideTransition(p, "financement", editor);
    expect(d.warnings.length).toBe(0);
  });
});

describe("nextPhase / previousPhase", () => {
  it("nextPhase passe à l'étape suivante", () => {
    expect(nextPhase("emergence")).toBe<ProjectPhase>("faisabilite");
    expect(nextPhase("realisation")).toBe<ProjectPhase>("bilan_cloture");
  });

  it("nextPhase renvoie null en bout de cycle", () => {
    expect(nextPhase("bilan_cloture")).toBeNull();
  });

  it("previousPhase recule d'une étape", () => {
    expect(previousPhase("faisabilite")).toBe<ProjectPhase>("emergence");
  });

  it("previousPhase renvoie null en début de cycle", () => {
    expect(previousPhase("emergence")).toBeNull();
  });
});

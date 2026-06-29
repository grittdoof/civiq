import { describe, it, expect } from "vitest";
import {
  decideTransition,
  nextPhase,
  previousPhase,
  findPhaseType,
  type ProjectSnapshot,
  type UserContext,
} from "@/lib/projects/state-machine";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// Tests de la machine à états — couvre les règles non négociables
// de la fiche fonctionnelle :
//   • avance étape par étape (gabarits investment / event / tracking)
//   • saut bloqué sans force ; saut avec force OK pour admin
//   • recul OK avec commentaire, refus sans commentaire
//   • Migration 028 : porte de financement et bilan obligatoire
//     deviennent des WARNINGS NON BLOQUANTS (briefing
//     « portes indicatives, jamais bloquantes »).
//   • Phases marquées « non applicable » : leur traversée n'est plus
//     considérée comme un saut.
// ═══════════════════════════════════════════════════════════════

function baseProject(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    type: "investment",
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

  it("refuse une phase qui n'appartient pas au gabarit", () => {
    const p = baseProject({ type: "tracking", phase: "tracking_framing" });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/n'appartient pas au gabarit/i);
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

  it("traverser une phase NA n'est pas considéré comme un saut", () => {
    const p = baseProject({
      phase: "emergence",
      phase_not_applicable: { faisabilite: "Compétence claire, pas d'étude" },
    });
    // emergence → decision_budget en sautant faisabilite (NA) : effStep = 1
    const d = decideTransition(p, "decision_budget", editor);
    expect(d.ok).toBe(true);
    expect(d.direction).toBe("forward");
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

describe("decideTransition — PORTE DE FINANCEMENT (warning non bloquant)", () => {
  // Le projet est en conception_marches et veut passer en realisation
  const ready = () => baseProject({ phase: "conception_marches" });

  it("AUTORISE le passage mais émet un warning si pas de subvention sécurisée", () => {
    const d = decideTransition(ready(), "realisation", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.length).toBe(1);
    expect(d.warnings[0]).toMatch(/subvention/i);
  });

  it("AUTORISE avec warning si subvention seulement « demandee »", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "demandee" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.length).toBe(1);
  });

  it("ACCEPTE sans warning si au moins une subvention ar_recu", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "ar_recu" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings).toEqual([]);
  });

  it("ACCEPTE sans warning si subvention accordée", () => {
    const p = baseProject({
      phase: "conception_marches",
      financings: [{ statut: "accordee" }],
    });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings).toEqual([]);
  });

  it("ACCEPTE sans warning si sans_subvention=true", () => {
    const p = baseProject({ phase: "conception_marches", sans_subvention: true });
    const d = decideTransition(p, "realisation", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings).toEqual([]);
  });
});

describe("decideTransition — BILAN (warning non bloquant)", () => {
  it("AUTORISE l'entrée dans bilan_cloture sans cout_reel mais émet un warning", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: null,
      explication_ecart: "tout bon",
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.some((w) => /bilan incomplet/i.test(w))).toBe(true);
  });

  it("AUTORISE avec warning si explication vide", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: 120000,
      explication_ecart: null,
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.length).toBe(1);
  });

  it("ACCEPTE sans warning si cout_reel et explication renseignés", () => {
    const p = baseProject({
      phase: "realisation",
      cout_reel: 120000,
      explication_ecart: "Léger dépassement dû à des fondations renforcées.",
    });
    const d = decideTransition(p, "bilan_cloture", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings).toEqual([]);
  });
});

describe("decideTransition — warnings non bloquants stakeholders", () => {
  it("warning à l'entrée de decision_budget si aucun rôle « decide »", () => {
    const p = baseProject({ phase: "faisabilite", stakeholders: [] });
    const d = decideTransition(p, "decision_budget", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings.some((w) => /décide/i.test(w))).toBe(true);
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

  it("aucun warning métier sur les gabarits event / tracking", () => {
    const p = baseProject({
      type: "event",
      phase: "event_framing",
      stakeholders: [],
    });
    const d = decideTransition(p, "event_authorizations", editor);
    expect(d.ok).toBe(true);
    expect(d.warnings).toEqual([]);
  });
});

describe("nextPhase / previousPhase", () => {
  it("nextPhase passe à l'étape suivante (investment)", () => {
    expect(nextPhase("emergence")).toBe<ProjectPhase>("faisabilite");
    expect(nextPhase("realisation")).toBe<ProjectPhase>("bilan_cloture");
  });

  it("nextPhase renvoie null en bout de cycle", () => {
    expect(nextPhase("bilan_cloture")).toBeNull();
    expect(nextPhase("event_review")).toBeNull();
    expect(nextPhase("tracking_review")).toBeNull();
  });

  it("previousPhase recule d'une étape", () => {
    expect(previousPhase("faisabilite")).toBe<ProjectPhase>("emergence");
  });

  it("previousPhase renvoie null en début de cycle", () => {
    expect(previousPhase("emergence")).toBeNull();
    expect(previousPhase("event_framing")).toBeNull();
    expect(previousPhase("tracking_framing")).toBeNull();
  });

  it("nextPhase/previousPhase fonctionnent pour event et tracking", () => {
    expect(nextPhase("event_framing")).toBe<ProjectPhase>("event_authorizations");
    expect(previousPhase("event_dday")).toBe<ProjectPhase>("event_logistics");
    expect(nextPhase("tracking_framing")).toBe<ProjectPhase>("tracking_execution");
  });
});

describe("findPhaseType", () => {
  it("retourne investment pour les phases investment", () => {
    expect(findPhaseType("emergence")).toBe("investment");
    expect(findPhaseType("bilan_cloture")).toBe("investment");
  });

  it("retourne event pour les phases event", () => {
    expect(findPhaseType("event_framing")).toBe("event");
    expect(findPhaseType("event_dday")).toBe("event");
  });

  it("retourne tracking pour les phases tracking", () => {
    expect(findPhaseType("tracking_framing")).toBe("tracking");
    expect(findPhaseType("tracking_review")).toBe("tracking");
  });
});

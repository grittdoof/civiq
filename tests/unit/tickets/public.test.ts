import { describe, expect, it } from "vitest";
import { agregatsPublics, themesPublies, type TicketPublic } from "@/lib/tickets/public";
import type { CategorieTicket } from "@/lib/tickets/categories";

const r = (id: string, code: string, actif = true): CategorieTicket => ({
  id, parent_id: null, code, libelle: id.toUpperCase(), icone: null, ordre: 1, actif, service_defaut_id: null,
  urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: null, gestionnaire_externe: null, consigne_urgence: null,
});
const racines = [r("v", "voirie"), r("p", "periscolaire"), r("s", "securite"), r("e", "espaces_verts"), r("x", "mobilier", false)];
const MAINT = new Date("2026-11-07T12:00:00Z");
const t = (o: Partial<TicketPublic>): TicketPublic => ({
  racine_id: "v", statut: "nouveau", created_at: "2026-11-01T12:00:00Z", pris_en_charge_at: null, termine_le: null, ...o,
});

describe("thèmes publiés", () => {
  it("par défaut : ni périscolaire, ni sécurité, ni catégorie désactivée", () => {
    expect(themesPublies(racines, null).map((x) => x.code)).toEqual(["voirie", "espaces_verts"]);
  });
  it("choix explicite de la commune", () => {
    expect(themesPublies(racines, ["p"]).map((x) => x.code)).toEqual(["periscolaire"]);
  });
});

describe("agrégats publics", () => {
  const themes = themesPublies(racines, null);
  const liste = [
    t({ statut: "clos", termine_le: "2026-11-04T12:00:00Z", pris_en_charge_at: "2026-11-02T00:00:00Z" }),
    t({ statut: "en_cours", created_at: "2026-11-05T12:00:00Z", pris_en_charge_at: "2026-11-08T12:00:00Z" }),
    t({ racine_id: "p", statut: "clos", termine_le: "2026-11-03T12:00:00Z" }),
    t({ racine_id: "e", statut: "clos", created_at: "2026-09-01T12:00:00Z", termine_le: "2026-09-10T12:00:00Z" }),
  ];
  it("ne compte que les thèmes publiés", () => {
    const a = agregatsPublics(liste, themes, "30j", MAINT);
    expect(a.terminees).toBe(1);
    expect(a.enCours).toBe(1);
    expect(a.delaiMoyenJours).toBe(3);
    expect(a.priseEnCharge48h).toBe(50);
    expect(a.parTheme.map((x) => [x.id, x.terminees, x.enCours])).toEqual([["v", 1, 1]]);
  });
  it("12 mois et histogramme mensuel", () => {
    const a = agregatsPublics(liste, themes, "12m", MAINT);
    expect(a.terminees).toBe(2);
    expect(a.parMois).toHaveLength(12);
    expect(a.parMois.at(-1)).toEqual({ cle: "2026-11", libelle: "nov.", terminees: 1 });
    expect(a.parMois.find((m) => m.cle === "2026-09")?.terminees).toBe(1);
  });
});

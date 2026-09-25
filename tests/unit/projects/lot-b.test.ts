import { describe, it, expect } from "vitest";
import {
  encartMarchesPublics,
  formatOffset,
  proposerJalons,
  validateWizard,
  wallClockIso,
} from "@/lib/projects/wizard";
import {
  avancementAffiche,
  formatEtapeDate,
  isEnRetard,
  joursAvant,
  libelleCompteARebours,
  nextStatut,
  sortRetroplanning,
} from "@/lib/projects/etapes";

const ELU = "11111111-1111-4111-8111-111111111111";
const COM = "22222222-2222-4222-8222-222222222222";

describe("proposerJalons", () => {
  const modeles = [
    { libelle: "Validation du principe", offset_jours: -90 },
    { libelle: "Déclaration SACEM", offset_jours: -21, conditionnel: true, aide: "Si musique" },
    { libelle: "Bilan", offset_jours: 7 },
  ];
  it("positionne le rétroplanning à rebours de la date de l'événement", () => {
    const j = proposerJalons(modeles, "2026-11-11");
    expect(j.map((x) => x.date_previsionnelle?.slice(0, 10))).toEqual(["2026-08-13", "2026-10-21", "2026-11-18"]);
  });
  it("propose les jalons conditionnels décochés", () => {
    const j = proposerJalons(modeles, "2026-11-11");
    expect(j.map((x) => x.coche)).toEqual([true, false, true]);
    expect(j[1].aide).toBe("Si musique");
  });
  it("sans date d'événement, les jalons n'ont pas de date", () => {
    expect(proposerJalons([{ libelle: "Estimation" }]).every((x) => x.date_previsionnelle === null)).toBe(true);
  });
  it("formate les positions", () => {
    expect([formatOffset(-30), formatOffset(0), formatOffset(7)]).toEqual(["J-30", "Jour J", "J+7"]);
  });
});

describe("wallClockIso", () => {
  it("stocke l'heure murale dans les composantes UTC", () => {
    expect(wallClockIso("2026-11-11", "10:30")).toBe("2026-11-11T10:30:00.000Z");
    expect(wallClockIso("2026-11-11")).toBe("2026-11-11T00:00:00.000Z");
    expect(wallClockIso("11/11/2026")).toBeNull();
  });
});

describe("encartMarchesPublics", () => {
  it("distingue obligatoire, recommandé et information", () => {
    expect(encartMarchesPublics("20k_100k")?.registre).toBe("recommande");
    expect(encartMarchesPublics("100k_500k")?.registre).toBe("obligatoire");
    expect(encartMarchesPublics("inconnu")?.registre).toBe("information");
    expect(encartMarchesPublics(null)).toBeNull();
  });
  it("ne met jamais la référence juridique en première position", () => {
    for (const f of ["moins_20k", "20k_100k", "100k_500k", "plus_500k"] as const) {
      const e = encartMarchesPublics(f)!;
      expect(e.paragraphes.join(" ")).not.toMatch(/Décret|article/i);
      expect(e.enSavoirPlus.join(" ")).toMatch(/Décret/);
    }
  });
});

describe("validateWizard", () => {
  it("suivi simple : titre + élu référent suffisent", () => {
    const r = validateWizard({ type_code: "suivi_simple", titre: " Rue Rivaudeau ", elu_referent_id: ELU });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.titre).toBe("Rue Rivaudeau");
  });
  it("exige un titre et un élu référent", () => {
    const r = validateWizard({ type_code: "suivi_simple", titre: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["elu_referent_id", "titre"]);
  });
  it("événement : la date est requise, fin après début", () => {
    expect(validateWizard({ type_code: "evenementiel", titre: "Fête", elu_referent_id: ELU }).ok).toBe(false);
    const r = validateWizard({
      type_code: "evenementiel", titre: "Fête", elu_referent_id: ELU,
      evenement_date: "2026-07-14", evenement_heure_debut: "18:00", evenement_heure_fin: "17:00",
    });
    expect(!r.ok && r.errors.evenement_heure_fin).toBeTruthy();
  });
  it("investissement : « pas d'échéance » ignore la date", () => {
    const r = validateWizard({
      type_code: "investissement", titre: "Clocher", elu_referent_id: ELU,
      fourchette_estimation: "100k_500k", echeance_souhaitee: "2027-06-30", sans_echeance: true,
    });
    expect(r.ok && r.payload.echeance_souhaitee).toBeNull();
    expect(r.ok && r.payload.fourchette_estimation).toBe("100k_500k");
  });
  it("écarte les identifiants invalides et la commission pilote des associées", () => {
    const r = validateWizard({
      type_code: "suivi_simple", titre: "x", elu_referent_id: ELU, commission_pilote_id: COM,
      commissions_associees: [COM, "pas-un-uuid"], contributeurs: [ELU, ELU],
    });
    expect(r.ok && r.payload.commissions_associees).toEqual([]);
    expect(r.ok && r.payload.contributeurs).toEqual([ELU]);
  });
  it("ne retient ni lieu ni partenaires hors événement", () => {
    const r = validateWizard({ type_code: "suivi_simple", titre: "x", elu_referent_id: ELU, lieu: "Salle", partenaires: [COM] });
    expect(r.ok && r.payload.lieu).toBeNull();
    expect(r.ok && r.payload.partenaires).toEqual([]);
  });
});

describe("étapes", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("détecte les retards sur le jour calendaire", () => {
    expect(isEnRetard({ statut: "a_faire", date_previsionnelle: "2026-09-24T09:00:00Z", fait: false, echeance: null }, now)).toBe(true);
    expect(isEnRetard({ statut: "a_faire", date_previsionnelle: "2026-09-25T09:00:00Z", fait: false, echeance: null }, now)).toBe(false);
    expect(isEnRetard({ statut: "termine", date_previsionnelle: "2026-01-01T00:00:00Z", fait: true, echeance: null }, now)).toBe(false);
    expect(isEnRetard({ statut: undefined, date_previsionnelle: null, fait: false, echeance: "2026-09-01" }, now)).toBe(true);
  });
  it("rétroplanning : retards en tête puis par date", () => {
    const e = (id: string, d: string, statut: "a_faire" | "termine" = "a_faire") =>
      ({ id, statut, date_previsionnelle: d, fait: statut === "termine", echeance: null });
    const sorted = sortRetroplanning([e("b", "2026-10-10"), e("late", "2026-09-01"), e("a", "2026-10-01"), e("done", "2026-08-01", "termine")], now);
    expect(sorted.map((x) => x.id)).toEqual(["late", "done", "a", "b"]);
  });
  it("compte à rebours", () => {
    expect(joursAvant("2026-11-06T18:00:00Z", now)).toBe(42);
    expect(libelleCompteARebours(42)).toBe("J-42");
    expect(libelleCompteARebours(0)).toBe("C'est aujourd'hui");
    expect(libelleCompteARebours(-3)).toBe("Passé de 3 jours");
  });
  it("cycle des statuts", () => {
    expect([nextStatut("a_faire"), nextStatut("en_cours"), nextStatut("termine")]).toEqual(["en_cours", "termine", "a_faire"]);
  });
  it("avancement : « non renseigné » sans jalon, surcharge manuelle prioritaire", () => {
    expect(avancementAffiche({ avancement_pct: null })).toEqual({ pct: null, manuel: false });
    expect(avancementAffiche({ avancement_pct: 25, avancement_manuel_pct: 60 })).toEqual({ pct: 60, manuel: true });
  });
  it("affiche l'heure seulement si elle a été saisie", () => {
    expect(formatEtapeDate("2026-09-05T00:00:00.000Z")).toBe("5 septembre 2026");
    expect(formatEtapeDate("2026-09-05T11:00:00.000Z")).toMatch(/5 septembre 2026.*11:00/);
  });
});

import { decideTypeChange } from "@/lib/projects/type-change";

describe("decideTypeChange", () => {
  const vide = { lignes_budget: 0, devis: 0, subventions: 0 };
  it("un suivi simple peut toujours évoluer", () => {
    expect(decideTypeChange("suivi_simple", "investissement", vide)).toEqual({ ok: true, avertissement: null });
    expect(decideTypeChange("suivi_simple", "evenementiel", vide).ok).toBe(true);
  });
  it("refuse investissement → suivi simple s'il y a des données financières, avec une alerte structurée", () => {
    const r = decideTypeChange("investissement", "suivi_simple", { lignes_budget: 2, devis: 1, subventions: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.alerte.constat).toMatch(/2 lignes de budget, 1 devis/);
      expect(r.alerte.actions.join(" ")).toMatch(/archivez/);
    }
  });
  it("autorise investissement → suivi simple sans données financières", () => {
    expect(decideTypeChange("investissement", "suivi_simple", vide).ok).toBe(true);
  });
  it("avertit sur la bascule fonctionnement / investissement", () => {
    const r = decideTypeChange("evenementiel", "investissement", vide);
    expect(r.ok && r.avertissement?.consequence).toMatch(/section/);
  });
});

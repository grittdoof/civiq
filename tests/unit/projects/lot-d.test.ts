import { describe, it, expect } from "vitest";
import {
  AVERTISSEMENT_SUGGESTION, campagneActive, lirePage, messageCampagne, normaliserAide,
  projetsSansDemande, suggererAides, type AideCache,
} from "@/lib/aides/aides";

describe("normaliserAide", () => {
  it("lit une aide au format de l'API et ignore les champs inconnus", () => {
    const a = normaliserAide({
      id: 12345, name: "Rénovation du patrimoine religieux", slug: "renovation-patrimoine",
      financers: ["Région Pays de la Loire", { name: "Département" }],
      categories: [{ name: "Patrimoine" }], submission_deadline: "2026-11-30",
      description: "<p>Soutien aux <strong>églises</strong>&nbsp;classées</p>", is_call_for_project: true,
      subvention_rate_max: 80,
    })!;
    expect(a.aide_id).toBe("12345");
    expect(a.financeurs).toEqual(["Région Pays de la Loire", "Département"]);
    expect(a.url).toBe("https://aides-territoires.beta.gouv.fr/aides/renovation-patrimoine/");
    expect(a.description).toBe("Soutien aux églises classées");
    expect(a.date_limite).toBe("2026-11-30");
    // Aucun taux ni montant n'est conservé.
    expect(JSON.stringify(a)).not.toMatch(/80/);
  });
  it("rejette une aide sans identifiant ou sans nom", () => {
    expect(normaliserAide({ name: "x" })).toBeNull();
    expect(normaliserAide({ id: 1 })).toBeNull();
  });
});

describe("lirePage", () => {
  it("accepte les formats DRF, API Platform et tableau", () => {
    expect(lirePage({ results: [{ id: 1 }], next: "https://x/?page=2" })).toEqual({ items: [{ id: 1 }], next: "https://x/?page=2" });
    expect(lirePage({ "hydra:member": [{ id: 2 }], "hydra:view": { "hydra:next": "/api/aids/?page=3" } }).next).toBe("/api/aids/?page=3");
    expect(lirePage([{ id: 3 }])).toEqual({ items: [{ id: 3 }], next: null });
    expect(lirePage(null)).toEqual({ items: [], next: null });
  });
});

describe("suggererAides", () => {
  const base = (p: Partial<AideCache>): AideCache => ({
    aide_id: "x", nom: "", slug: null, url: null, url_candidature: null, financeurs: [], categories: [], types_aide: [],
    description: null, date_ouverture: null, date_limite: null, recurrence: null, appel_a_projets: false, perimetre: null, source_maj: null, ...p,
  });
  const aides = [
    base({ aide_id: "1", nom: "Restauration du patrimoine religieux", categories: ["Patrimoine"], date_limite: "2026-12-15" }),
    base({ aide_id: "2", nom: "Clochers et églises rurales", description: "restauration clocher", date_limite: "2026-10-31" }),
    base({ aide_id: "3", nom: "Voirie communale", date_limite: "2026-12-01" }),
    base({ aide_id: "4", nom: "Clocher (appel clos)", date_limite: "2026-01-01" }),
  ];
  it("classe par pertinence et écarte les dates limites passées", () => {
    const s = suggererAides(aides, { titre: "Rénovation du clocher de l'église", description: "restauration patrimoine" }, "2026-09-25");
    expect(s.map((x) => x.aide_id)).toEqual(["2", "1"]);
  });
  it("ne propose rien sans mot significatif", () => {
    expect(suggererAides(aides, { titre: "Projet" }, "2026-09-25")).toEqual([]);
  });
  it("la formulation imposée n'annonce pas d'éligibilité", () => {
    expect(AVERTISSEMENT_SUGGESTION).toMatch(/^Piste à explorer/);
    expect(AVERTISSEMENT_SUGGESTION).toMatch(/seul le financeur peut confirmer/);
  });
});

describe("alerte de campagne", () => {
  it("ne tourne que de septembre à décembre", () => {
    expect(campagneActive(new Date("2026-09-15T00:00:00Z"))).toBe(true);
    expect(campagneActive(new Date("2026-12-31T00:00:00Z"))).toBe(true);
    expect(campagneActive(new Date("2026-06-01T00:00:00Z"))).toBe(false);
  });
  it("retient les investissements de l'année suivante sans demande déposée", () => {
    const projets = [
      { id: "a", titre: "Clocher", type_code: "investissement", echeance_souhaitee: "2027-06-30" },
      { id: "b", titre: "Voirie", type_code: "investissement", echeance_souhaitee: "2027-03-01" },
      { id: "c", titre: "Fête", type_code: "evenementiel", echeance_souhaitee: "2027-07-14" },
      { id: "d", titre: "Halles", type_code: "investissement", echeance_souhaitee: "2028-01-01" },
      { id: "e", titre: "Autofinancé", type_code: "investissement", echeance_souhaitee: "2027-05-01", autofinancement_assume: true },
      { id: "f", titre: "Archivé", type_code: "investissement", echeance_souhaitee: "2027-05-01", archived_at: "2026-09-01" },
    ];
    const r = projetsSansDemande(projets, [{ project_id: "b", statut: "demandee" }, { project_id: "a", statut: "a_demander" }], 2027);
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });
  it("message conforme à la doctrine (constat, conséquence, action, puis juridique)", () => {
    const m = messageCampagne(3, 2027);
    expect(m.constat).toBe("3 projets d'investissement prévus en 2027 n'ont aucune demande de subvention déposée.");
    expect(m.consequence).toMatch(/dotation d'équipement des territoires ruraux \(DETR\)/);
    expect(m.enSavoirPlus[0]).toMatch(/fin novembre.*50 000 €/);
  });
});

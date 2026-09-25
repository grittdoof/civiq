import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMETRES,
  validateParametresPatch,
  type CommuneParametres,
} from "@/lib/projects/commune-parametres";
import { contactTypeFromCategorie, normalizeEmail } from "@/lib/projects/contacts";
import { softDeleteFields } from "@/lib/projects/soft-delete";

const current: CommuneParametres = { commune_id: "c1", ...DEFAULT_PARAMETRES };

describe("validateParametresPatch", () => {
  it("un PATCH partiel ne touche que les champs envoyés", () => {
    const r = validateParametresPatch({ taux_fctva: 16.404 }, current);
    expect(r).toEqual({ ok: true, updates: { taux_fctva: 16.404 } });
  });

  it("accepte le format français (espaces, virgule)", () => {
    const r = validateParametresPatch(
      { seuil_delegation_maire_ht: "40 000,50", delegation_deliberation_num: "2026-12", delegation_deliberation_date: "2026-04-02" },
      current,
    );
    expect(r.ok && r.updates.seuil_delegation_maire_ht).toBe(40000.5);
  });

  it("exige la délibération quand un seuil de délégation est saisi", () => {
    const r = validateParametresPatch({ seuil_delegation_maire_ht: 40000 }, current);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.delegation_deliberation_num).toBeDefined();
      expect(r.errors.delegation_deliberation_date).toBeDefined();
    }
  });

  it("tient compte de la délibération déjà enregistrée", () => {
    const withDelib = { ...current, delegation_deliberation_num: "12", delegation_deliberation_date: "2026-04-02" };
    expect(validateParametresPatch({ seuil_delegation_maire_ht: 40000 }, withDelib).ok).toBe(true);
  });

  it("vider le seuil désactive l'alerte sans exiger de délibération", () => {
    const r = validateParametresPatch({ seuil_delegation_maire_ht: "", delegation_deliberation_num: "" }, current);
    expect(r).toEqual({ ok: true, updates: { seuil_delegation_maire_ht: null, delegation_deliberation_num: null } });
  });

  it("refuse les valeurs hors bornes", () => {
    const r = validateParametresPatch({ nb_devis_exige: 0, taux_fctva: 120, seuil_devis_exige_ht: -1 }, current);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["nb_devis_exige", "seuil_devis_exige_ht", "taux_fctva"]);
  });

  it("valide le code INSEE (y compris la Corse)", () => {
    expect(validateParametresPatch({ code_insee: "85065" }, current).ok).toBe(true);
    expect(validateParametresPatch({ code_insee: "2a004" }, current)).toEqual({ ok: true, updates: { code_insee: "2A004" } });
    expect(validateParametresPatch({ code_insee: "85 065" }, current).ok).toBe(false);
    expect(validateParametresPatch({ code_insee: "8506" }, current).ok).toBe(false);
  });

  it("le guide interne est désactivé par défaut", () => {
    expect(DEFAULT_PARAMETRES.regles_internes_actives).toBe(false);
    expect(validateParametresPatch({ regles_internes_actives: "oui" }, current))
      .toEqual({ ok: true, updates: { regles_internes_actives: false } });
  });
});

describe("contacts", () => {
  it("déduit la nature du contact de la catégorie de partie prenante", () => {
    expect(contactTypeFromCategorie("financeur")).toBe("financeur");
    expect(contactTypeFromCategorie("institutionnelle")).toBe("collectivite");
    expect(contactTypeFromCategorie("technique")).toBe("entreprise");
    expect(contactTypeFromCategorie("citoyenne")).toBe("personne");
    expect(contactTypeFromCategorie(null)).toBe("personne");
  });

  it("normalise l'email pour le dédoublonnage", () => {
    expect(normalizeEmail("  Jean.Dupont@Mairie.FR ")).toBe("jean.dupont@mairie.fr");
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("softDeleteFields", () => {
  it("marque la ligne sans la supprimer", () => {
    const f = softDeleteFields("u1");
    expect(f.deleted_by).toBe("u1");
    expect(Number.isNaN(Date.parse(f.deleted_at))).toBe(false);
    expect(softDeleteFields(undefined).deleted_by).toBeNull();
  });
});

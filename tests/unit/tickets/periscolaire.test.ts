import { describe, expect, it } from "vitest";
import { dateEffacementEnfant, destinatairesAuto, estPeriscolaire, lireSite, validerPeriscolaire } from "@/lib/tickets/periscolaire";
import { validerReglages } from "@/lib/tickets/categories-validation";
import type { CategorieTicket } from "@/lib/tickets/categories";

const base = { icone: null, ordre: 1, actif: true, service_defaut_id: null, urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: null, gestionnaire_externe: null, consigne_urgence: null } as const;
const cats = [
  { ...base, id: "peri", parent_id: null, code: "periscolaire", libelle: "Périscolaire" },
  { ...base, id: "inc", parent_id: "peri", code: "incident_enfant", libelle: "Incident enfant", notifier_fonctions: ["maire", "dgs", "secretaire"] },
  { ...base, id: "cant", parent_id: "peri", code: "materiel_cantine", libelle: "Cantine" },
  { ...base, id: "voi", parent_id: null, code: "voirie", libelle: "Voirie" },
] as Array<CategorieTicket & { notifier_fonctions?: string[] | null }>;

describe("périscolaire", () => {
  it("reconnaît la catégorie et ses sous-catégories", () => {
    expect(estPeriscolaire("inc", cats)).toBe(true);
    expect(estPeriscolaire("peri", cats)).toBe(true);
    expect(estPeriscolaire("voi", cats)).toBe(false);
    expect(estPeriscolaire(null, cats)).toBe(false);
  });

  it("valide les précisions (minimisation)", () => {
    expect(validerPeriscolaire({ enfant: "  Léa   M. ", creneau: "midi", famille_informee: true, site_id: "s1" }))
      .toEqual({ site_id: "s1", creneau: "midi", enfant: "Léa M.", famille_informee: true });
    expect(validerPeriscolaire({}).enfant).toBeNull();
    expect(() => validerPeriscolaire({ enfant: "x".repeat(81) })).toThrow();
    expect(() => validerPeriscolaire({ creneau: "nuit" })).toThrow();
    expect(() => validerPeriscolaire({ famille_informee: "oui" })).toThrow();
  });

  it("efface au 31 août qui suit la clôture, ou après le délai de la commune (miroir SQL)", () => {
    expect(dateEffacementEnfant("2026-03-10T10:00:00Z", null)).toBe("2026-08-31");
    expect(dateEffacementEnfant("2026-10-05T10:00:00Z", null)).toBe("2027-08-31");
    expect(dateEffacementEnfant("2026-08-31T23:30:00Z", null)).toBe("2027-08-31"); // 1er sept. à Paris
    expect(dateEffacementEnfant("2026-03-10T10:00:00Z", 6)).toBe("2026-09-10");
    expect(dateEffacementEnfant(null, null)).toBeNull();
  });

  it("remonte l'incident enfant aux fonctions prévues", () => {
    const profils = [
      { id: "m", job_title: "maire", role: "admin" },
      { id: "d", job_title: "dgs", role: "editor" },
      { id: "a", job_title: "agent", role: "editor" },
      { id: "v", job_title: "secretaire", role: "viewer" },
    ];
    expect(destinatairesAuto("inc", cats, profils)).toEqual(["m", "d"]);
    expect(destinatairesAuto("cant", cats, profils)).toEqual([]);
    // Maire super-admin : prévenu, jamais nommé destinataire
    const avecSuper = [...profils.slice(1), { id: "s", job_title: "maire", role: "super_admin" }];
    expect(destinatairesAuto("inc", cats, avecSuper)).toEqual(["d"]);
    expect(destinatairesAuto("inc", cats, avecSuper, ["admin", "editor", "super_admin"])).toEqual(["d", "s"]);
  });

  it("lit un lieu et le réglage « prévenir automatiquement »", () => {
    expect(lireSite({ nom: "  École  Jules-Ferry ", type: "ecole" })).toEqual({ nom: "École Jules-Ferry", type: "ecole", adresse: null });
    expect(() => lireSite({ nom: "x" })).toThrow();
    expect(() => lireSite({ nom: "Gymnase", type: "piscine" })).toThrow();
    expect(validerReglages({ notifier_fonctions: ["maire", "dgs", "maire"] }, [])).toEqual({ notifier_fonctions: ["maire", "dgs"] });
    expect(validerReglages({ notifier_fonctions: [] }, [])).toEqual({ notifier_fonctions: null });
    expect(() => validerReglages({ notifier_fonctions: ["pape"] }, [])).toThrow();
  });
});

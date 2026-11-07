import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  URGENCES, arborescence, cheminCategorie, etatDelai, formatDelai, prioriteDepuisUrgence,
  reglagesEffectifs, suggererCategorie, urgenceDepuisPriorite, type CategorieTicket, type Urgence,
} from "@/lib/tickets/categories";

// ─── Taxonomie de départ lue dans la migration 059 (source unique) ───
const sql = readFileSync("supabase/migrations/059_tickets_categories.sql", "utf8");
function valeurs(ligne: string): Array<string | number | null> {
  const out: Array<string | number | null> = [];
  const re = /'((?:[^']|'')*)'|(-?\d+)|(null)(?:::text)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ligne))) out.push(m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2] !== undefined ? Number(m[2]) : null);
  return out;
}
const lignes = sql.split("\n").filter((l) => /^\s{4}\('/.test(l));
const cats: CategorieTicket[] = [];
for (const l of lignes) {
  const v = valeurs(l);
  if (v.length === 7) {
    const [code, libelle, icone, ordre, , delai, gestionnaire] = v;
    cats.push({ id: String(code), parent_id: null, code: String(code), libelle: String(libelle), icone: String(icone), ordre: Number(ordre), actif: true, service_defaut_id: null, urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: delai as number | null, gestionnaire_externe: gestionnaire as string | null, consigne_urgence: null });
  } else if (v.length === 10) {
    const [parent, code, libelle, ordre, urgence, delai, conf, , gestionnaire, consigne] = v;
    cats.push({ id: String(code), parent_id: String(parent), code: String(code), libelle: String(libelle), icone: null, ordre: Number(ordre), actif: true, service_defaut_id: null, urgence_defaut: urgence as Urgence | null, confidentialite_defaut: conf as CategorieTicket["confidentialite_defaut"], delai_cible_heures: delai as number | null, gestionnaire_externe: gestionnaire as string | null, consigne_urgence: consigne as string | null });
  }
}

describe("taxonomie de départ (migration 059)", () => {
  it("16 catégories, chaque sous-catégorie a sa catégorie", () => {
    const arbre = arborescence(cats);
    expect(arbre).toHaveLength(16);
    expect(arbre[0].code).toBe("voirie");
    expect(arbre.at(-1)!.code).toBe("autre");
    for (const c of cats.filter((x) => x.parent_id)) expect(cats.some((r) => r.id === c.parent_id)).toBe(true);
    expect(arbre.find((r) => r.code === "voirie")!.enfants.map((e) => e.code)).toContain("nid_de_poule");
  });

  it("odeur de gaz : danger immédiat, consigne et délai d'1 h", () => {
    const r = reglagesEffectifs("odeur_gaz", cats);
    expect(r.urgence).toBe("danger_immediat");
    expect(r.consigne).toBe("GAZ");
    expect(r.delaiHeures).toBe(1);
    expect(r.gestionnaire).toBe("GRDF");
  });

  it("la sous-catégorie hérite des réglages manquants de sa catégorie", () => {
    const r = reglagesEffectifs("nid_de_poule", cats);
    expect(r.urgence).toBe("normale");
    expect(r.delaiHeures).toBe(120);
    expect(r.gestionnaire).toBe("Département (routes départementales)");
    expect(reglagesEffectifs("incident_enfant", cats).confidentialite).toBe("restreint");
    expect(reglagesEffectifs(null, cats).urgence).toBe("normale");
  });

  it("chemin lisible", () => {
    expect(cheminCategorie("nid_de_poule", cats).libelle).toBe("Voirie & circulation › Nid-de-poule");
    expect(cheminCategorie("voirie", cats).libelle).toBe("Voirie & circulation");
    expect(cheminCategorie("inconnu", cats).libelle).toBe("Sans catégorie");
  });
});

describe("urgence (miroir du déclencheur SQL)", () => {
  it("convertit dans les deux sens sans inventer de danger immédiat", () => {
    expect(URGENCES.map(prioriteDepuisUrgence)).toEqual(["basse", "normale", "haute", "urgente"]);
    expect(["basse", "normale", "haute", "urgente"].map(urgenceDepuisPriorite)).toEqual(["faible", "normale", "urgente", "urgente"]);
  });
});

describe("délai cible", () => {
  it("formate les délais", () => {
    expect(formatDelai(4)).toBe("4 h");
    expect(formatDelai(48)).toBe("2 jours");
    expect(formatDelai(168)).toBe("1 semaine");
    expect(formatDelai(null)).toBe("Aucun");
  });
  it("à temps, proche, dépassé ; rien si clôturé", () => {
    const cree = "2026-11-01T08:00:00Z";
    const fin = "2026-11-06T08:00:00Z";
    expect(etatDelai(fin, cree, true, new Date("2026-11-02T08:00:00Z"))).toBe("a_temps");
    expect(etatDelai(fin, cree, true, new Date("2026-11-05T12:00:00Z"))).toBe("proche");
    expect(etatDelai(fin, cree, true, new Date("2026-11-07T08:00:00Z"))).toBe("depasse");
    expect(etatDelai(fin, cree, false, new Date("2026-11-07T08:00:00Z"))).toBeNull();
    expect(etatDelai(null, cree, true)).toBeNull();
  });
});

describe("suggestion de requalification", () => {
  const cas: Array<[string, string | null, string | null]> = [
    ["Demande de rendez-vous", "M. X souhaite vous rencontrer", "rendez_vous"],
    ["Comptabilité", "Pouvez-vous signer les mandats et les titres ?", "signature"],
    ["Demande location salle", "Répétition une fois par mois", "salle"],
    ["Câble téléphonique", "Un câble téléphonique est au sol", "cable_tombe"],
    ["Chien divagant et agressif", null, "chien_errant"],
    ["Poubelle carton", "La poubelle des cartons est pleine", "poubelle"],
    ["Raccordement fibre", "La salle n'est pas raccordée à la fibre", "fibre_internet"],
    ["Cityparc", "Plusieurs boulons sont partis de la structure", "jeux_enfants"],
    ["Installation panneau électoral", "affichage temporaire", "panneau_affichage"],
    ["Odeur de brulé au périscolaire", "sèche-linge, odeur de brûler", "batiment_ecole"],
    ["Prise électrique qui chauffe", "odeur de brûlé dans la salle", "electricite"],
    ["Peinture sur toile", "Elle est partie en maison de retraite", null],
  ];
  for (const [titre, desc, attendu] of cas) {
    it(`« ${titre} » → ${attendu ?? "aucune suggestion"}`, () => {
      expect(suggererCategorie(titre, desc, cats)?.id ?? null).toBe(attendu);
    });
  }
});

import { codeDepuisLibelle, validerReglages } from "@/lib/tickets/categories-validation";

describe("réglages d'une catégorie (administration)", () => {
  const icones = ["route", "circle-help"];
  it("accepte et normalise des réglages valides", () => {
    expect(validerReglages({ libelle: "  Fuite  ", delai_cible_heures: 48, urgence_defaut: "urgente", gestionnaire_externe: "", actif: false }, icones))
      .toEqual({ libelle: "Fuite", delai_cible_heures: 48, urgence_defaut: "urgente", gestionnaire_externe: null, actif: false });
    expect(validerReglages({ urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: null }, icones))
      .toEqual({ urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: null });
  });
  it("refuse les valeurs hors liste ou hors bornes", () => {
    expect(() => validerReglages({ libelle: "x" }, icones)).toThrow();
    expect(() => validerReglages({ urgence_defaut: "extreme" }, icones)).toThrow();
    expect(() => validerReglages({ confidentialite_defaut: "secret" }, icones)).toThrow();
    expect(() => validerReglages({ delai_cible_heures: 0 }, icones)).toThrow();
    expect(() => validerReglages({ delai_cible_heures: 1.5 }, icones)).toThrow();
    expect(() => validerReglages({ icone: "fusee" }, icones)).toThrow();
    expect(() => validerReglages({ consigne_urgence: "x".repeat(1001) }, icones)).toThrow();
  });
  it("fabrique un code stable depuis le libellé", () => {
    expect(codeDepuisLibelle("Fuite d'eau")).toBe("fuite_d_eau");
    expect(codeDepuisLibelle("Éclairage — façade")).toBe("eclairage_facade");
    expect(codeDepuisLibelle("!!!")).toBe("categorie");
  });
});

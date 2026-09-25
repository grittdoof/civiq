import { describe, it, expect } from "vitest";
import { evaluerAlertesMarches, montantReferenceMarche, seuilApplicable, type Seuil } from "@/lib/projects/marches";
import { calculerPlan, consommationBudget, subventionSansAr, totauxBudget, versHt, versTtc, type LigneBudget } from "@/lib/projects/financement";

// Seed du brief §2.7 (identique à la migration 041).
const SEUILS: Seuil[] = [
  { categorie: "travaux", type: "dispense", montant_ht: 40000, date_effet: "2020-01-01", date_fin: "2025-12-31", reference: null },
  { categorie: "travaux", type: "dispense", montant_ht: 100000, date_effet: "2026-01-01", date_fin: "2026-12-31", reference: "Décret n° 2025-1386" },
  { categorie: "travaux", type: "dispense", montant_ht: 140000, date_effet: "2027-01-01", date_fin: null, reference: "Loi n° 2026-403" },
  { categorie: "fournitures_services", type: "dispense", montant_ht: 40000, date_effet: "2020-01-01", date_fin: "2026-03-31", reference: null },
  { categorie: "fournitures_services", type: "dispense", montant_ht: 60000, date_effet: "2026-04-01", date_fin: null, reference: "Décret n° 2025-1386" },
  { categorie: "travaux", type: "seuil_europeen", montant_ht: 5404000, date_effet: "2026-01-01", date_fin: "2027-12-31", reference: null },
];

const SANS_PARAMS = {
  seuil_delegation_maire_ht: null, delegation_deliberation_num: null, delegation_deliberation_date: null,
  regles_internes_actives: false, nb_devis_exige: 3, seuil_devis_exige_ht: 5000,
};

describe("seuilApplicable — date d'engagement de la consultation", () => {
  it("un marché de fournitures engagé en février 2026 relève encore du seuil de 40 000 €", () => {
    expect(seuilApplicable(SEUILS, "fournitures_services", "dispense", "2026-02-15")?.montant_ht).toBe(40000);
    expect(seuilApplicable(SEUILS, "fournitures_services", "dispense", "2026-04-01")?.montant_ht).toBe(60000);
  });
  it("travaux : 40 000 € en 2025, 100 000 € en 2026, 140 000 € en 2027", () => {
    expect(seuilApplicable(SEUILS, "travaux", "dispense", "2025-12-31")?.montant_ht).toBe(40000);
    expect(seuilApplicable(SEUILS, "travaux", "dispense", "2026-06-01")?.montant_ht).toBe(100000);
    expect(seuilApplicable(SEUILS, "travaux", "dispense", "2027-02-01")?.montant_ht).toBe(140000);
  });
});

describe("evaluerAlertesMarches", () => {
  const base = { categorie: "travaux" as const, dateConsultation: "2026-06-01", nbDevis: 1, seuils: SEUILS };

  it("silence complet quand les paramètres communaux sont vides et le montant sous les seuils", () => {
    expect(evaluerAlertesMarches({ ...base, montantHt: 60000, parametres: SANS_PARAMS })).toEqual([]);
  });
  it("alerte de délégation avec le numéro et la date de la délibération", () => {
    const r = evaluerAlertesMarches({
      ...base, montantHt: 60000,
      parametres: { ...SANS_PARAMS, seuil_delegation_maire_ht: 40000, delegation_deliberation_num: "2026-12", delegation_deliberation_date: "2026-04-02" },
    });
    expect(r.map((a) => a.code)).toEqual(["delegation"]);
    expect(r[0].alerte.constat).toMatch(/n° 2026-12 du 2 avril 2026/);
    expect(r[0].registre).toBe("obligatoire");
  });
  it("publicité obligatoire au-delà du seuil en vigueur à la date de consultation", () => {
    expect(evaluerAlertesMarches({ ...base, montantHt: 120000, parametres: SANS_PARAMS }).map((a) => a.code)).toEqual(["publicite"]);
    // Même montant, consultation engagée en 2027 : seuil 140 000 € → pas d'alerte.
    expect(evaluerAlertesMarches({ ...base, dateConsultation: "2027-03-01", montantHt: 120000, parametres: SANS_PARAMS })).toEqual([]);
  });
  it("guide interne : recommandation seulement si activé", () => {
    const actif = { ...SANS_PARAMS, regles_internes_actives: true };
    const r = evaluerAlertesMarches({ ...base, montantHt: 8000, nbDevis: 1, parametres: actif });
    expect(r).toHaveLength(1);
    expect(r[0].registre).toBe("recommande");
    // toLocaleString("fr-FR") sépare les milliers par une espace insécable.
    expect(r[0].alerte.constat.replace(/[\u202f\u00a0]/g, " ")).toMatch(/prévoit 3 devis au-delà de 5 000 € HT\. Vous n'en avez enregistré que 1/);
    expect(evaluerAlertesMarches({ ...base, montantHt: 8000, nbDevis: 1, parametres: SANS_PARAMS })).toEqual([]);
  });
  it("les références juridiques restent dans « En savoir plus »", () => {
    const r = evaluerAlertesMarches({ ...base, montantHt: 120000, parametres: SANS_PARAMS });
    expect(r[0].alerte.constat + r[0].alerte.consequence).not.toMatch(/Décret|article/i);
    expect(r[0].enSavoirPlus.join(" ")).toMatch(/Décret/);
  });
});

describe("montantReferenceMarche", () => {
  it("retient la somme des devis retenus, sinon le plus haut devis, sinon l'estimation", () => {
    expect(montantReferenceMarche([{ montant_ht: 10, statut: "retenu", lot: "A" }, { montant_ht: 30, statut: "retenu", lot: "B" }], 99)).toEqual({ montant: 40, source: "devis_retenu" });
    expect(montantReferenceMarche([{ montant_ht: 10, statut: "recu" }, { montant_ht: 30, statut: "recu" }], 99)).toEqual({ montant: 30, source: "devis" });
    expect(montantReferenceMarche([], 99)).toEqual({ montant: 99, source: "estimation" });
  });
});

describe("budget et plan de financement", () => {
  const l = (p: Partial<LigneBudget>): LigneBudget => ({ sens: "depense", base: "ht", taux_tva: 20, etat: "previsionnel", montant_prevu: null, montant_reel: null, ...p });

  it("conversions HT / TTC", () => {
    expect(versTtc(100, "ht", 20)).toBe(120);
    expect(versHt(120, "ttc", 20)).toBe(100);
  });
  it("trois états : prévu, engagé, payé", () => {
    const t = totauxBudget([
      l({ montant_prevu: 1000 }),
      l({ montant_prevu: 2000, etat: "engage", montant_reel: 2100 }),
      l({ montant_prevu: 500, etat: "mandate", montant_reel: 500 }),
    ], "ht");
    expect(t).toMatchObject({ prevu: 3500, engage: 2600, mandate: 500 });
    expect(consommationBudget(t)).toBe(74);
  });
  it("événement : solde net recettes − dépenses en TTC", () => {
    const t = totauxBudget([
      l({ base: "ttc", montant_prevu: 800 }),
      l({ sens: "recette", base: "ttc", montant_prevu: 300 }),
    ], "ttc");
    expect(t.solde).toBe(-500);
  });
  it("contrôles 20 % / 80 % sur le HT et FCTVA sur le TTC", () => {
    const plan = calculerPlan({
      type: "investissement",
      lignes: [l({ montant_prevu: 100000 })],
      subventions: [
        { statut: "accordee", montant_demande: 50000, montant_obtenu: 45000 },
        { statut: "demandee", montant_demande: 40000, montant_obtenu: null },
        { statut: "refusee", montant_demande: 30000, montant_obtenu: null },
      ],
      emprunt: 0, autofinancement_invest: 0, autofinancement_fonct: 0, taux_fctva: 16.404,
    });
    expect(plan.aides_retenues).toBe(85000);
    expect(plan.aides_pct).toBe(85);
    expect(plan.controle_aides_ok).toBe(false);
    expect(plan.aides_depassement).toBe(5000);
    expect(plan.controle_part_commune_ok).toBe(false);
    expect(plan.part_commune_manquante).toBe(5000);
    expect(plan.fctva).toBe(19684.8);
  });
  it("événement : ni FCTVA, ni contrôles sans budget", () => {
    const plan = calculerPlan({ type: "evenementiel", lignes: [], subventions: [], emprunt: null, autofinancement_invest: null, autofinancement_fonct: null, taux_fctva: 16.404 });
    expect(plan.fctva).toBe(0);
    expect(plan.controle_aides_ok).toBeNull();
  });
  it("relance : dossier déposé sans accusé de réception depuis plus de 21 jours", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(subventionSansAr({ statut: "demandee", date_demande: "2026-09-01", date_ar: null }, now)).toBe(true);
    expect(subventionSansAr({ statut: "demandee", date_demande: "2026-09-10", date_ar: null }, now)).toBe(false);
    expect(subventionSansAr({ statut: "demandee", date_demande: "2026-09-01", date_ar: "2026-09-05" }, now)).toBe(false);
  });
});

import { parseBudgetLine, parseFinancing, parseMontant, parseQuote } from "@/lib/projects/money-validation";

describe("validation des saisies financières", () => {
  it("lit les montants au format français", () => {
    expect(parseMontant("12 500,50 €")).toBe(12500.5);
    expect(parseMontant("")).toBeNull();
    expect(Number.isNaN(parseMontant("-3"))).toBe(true);
  });
  it("un devis sans montant HT est refusé", () => {
    const r = parseQuote({ prestataire: "CROCHET TP", montant_ttc: 1200 }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/hors taxes \(HT\) est obligatoire/);
    expect(parseQuote({ prestataire: "CROCHET TP", montant_ht: "458" }, true)).toEqual({ ok: true, value: { prestataire: "CROCHET TP", montant_ht: 458 } });
  });
  it("une ligne de budget exige sens, libellé et montant", () => {
    expect(parseBudgetLine({ sens: "depense", libelle: "Clocher" }, true).ok).toBe(false);
    expect(parseBudgetLine({ sens: "depense", libelle: "Clocher", montant_prevu: 1000, etat: "engage" }, true).ok).toBe(true);
    expect(parseBudgetLine({ etat: "facture" }, false).ok).toBe(false);
  });
  it("l'accusé de réception ne précède pas le dépôt", () => {
    expect(parseFinancing({ financeur: "État", date_demande: "2026-10-10", date_ar: "2026-10-01" }, true).ok).toBe(false);
    expect(parseFinancing({ financeur: "État", statut: "ar_recu", date_demande: "2026-10-01", date_ar: "2026-10-10" }, true).ok).toBe(true);
  });
});

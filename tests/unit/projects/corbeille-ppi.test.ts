import { describe, expect, it } from "vitest";
import { CORBEILLE_JOURS, expire, joursRestants, peutSupprimerProjet } from "@/lib/projects/corbeille";
import { anneeProgrammation, construirePpi } from "@/lib/projects/ppi";
import type { LigneBudget } from "@/lib/projects/financement";
import type { SubventionPilotage } from "@/lib/projects/pilotage";

describe("corbeille des projets", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  it("30 jours de corbeille", () => {
    expect(CORBEILLE_JOURS).toBe(30);
    expect(joursRestants("2026-10-30T12:00:00Z", now)).toBe(29);
    expect(joursRestants("2026-10-01T13:00:00Z", now)).toBe(1);
    expect(joursRestants("2026-09-01T00:00:00Z", now)).toBe(0);
  });
  it("expire au-delà de 30 jours", () => {
    expect(expire("2026-10-01T11:00:00Z", now)).toBe(true);
    expect(expire("2026-10-02T00:00:00Z", now)).toBe(false);
  });
  it("bureau, élu référent ou agent peuvent mettre à la corbeille", () => {
    const p = { pilote_elu: "ref", pilote_agent: "agent" };
    expect(peutSupprimerProjet({ id: "x", role: "admin" }, p)).toBe(true);
    expect(peutSupprimerProjet({ id: "ref", role: "editor" }, p)).toBe(true);
    expect(peutSupprimerProjet({ id: "agent", role: "editor" }, p)).toBe(true);
    expect(peutSupprimerProjet({ id: "x", role: "editor" }, p)).toBe(false);
    expect(peutSupprimerProjet(null, p)).toBe(false);
  });
});

describe("PPI sur le nouveau modèle", () => {
  const ligne = (o: Partial<LigneBudget>): LigneBudget => ({ sens: "depense", base: "ht", taux_tva: 20, etat: "previsionnel", montant_prevu: 0, montant_reel: null, ...o });
  const projets = [
    { id: "a", titre: "Église", type_code: "investissement", echeance_souhaitee: "2027-06-01", budget_estime: 999, avancement_pct: 40 },
    { id: "b", titre: "Voirie", type_code: "investissement", date_creation: "2026-02-01T00:00:00Z", budget_estime: 50_000 },
    { id: "c", titre: "Fête", type_code: "evenementiel", echeance_souhaitee: "2027-01-01" },
    { id: "d", titre: "Retiré", type_code: "investissement", in_ppi: false, budget_estime: 10 },
    { id: "e", titre: "Accompagné", type_code: "investissement", accompagne_sans_financer: true },
  ];
  const ppi = construirePpi({
    projets,
    lignesParProjet: new Map([["a", [ligne({ montant_prevu: 120_000 }), ligne({ base: "ttc", montant_prevu: 12_000 })]]]),
    subventionsParProjet: new Map<string, SubventionPilotage[]>([["a", [
      { project_id: "a", statut: "accordee", montant_demande: 40_000, montant_obtenu: 30_000, date_demande: null, date_ar: null },
      { project_id: "a", statut: "demandee", montant_demande: 20_000, montant_obtenu: null, date_demande: null, date_ar: null },
      { project_id: "a", statut: "a_demander", montant_demande: 5_000, montant_obtenu: null, date_demande: null, date_ar: null },
    ]]]),
    statuts: new Map([["b", "termine"]]),
  });
  it("uniquement les investissements, hors accompagnement", () => {
    expect(ppi.annees.flatMap((a) => a.lignes.map((l) => l.id)).sort()).toEqual(["a", "b"]);
    expect(ppi.exclus.map((l) => l.id)).toEqual(["d"]);
  });
  it("année = échéance souhaitée, à défaut création", () => {
    expect(ppi.annees.map((a) => a.annee)).toEqual([2026, 2027]);
    expect(anneeProgrammation({ echeance_souhaitee: null, date_creation: null }, new Date("2030-01-01"))).toBe(2030);
  });
  it("montant HT du budget, à défaut l'estimation", () => {
    const a = ppi.annees[1].lignes[0];
    expect(a).toMatchObject({ montantHt: 130_000, sollicite: 60_000, obtenu: 30_000, reste: 100_000, estimation: false, etat: "Avancement 40 %" });
    expect(ppi.annees[0].lignes[0]).toMatchObject({ montantHt: 50_000, estimation: true, etat: "Terminé" });
  });
  it("totaux", () => {
    expect(ppi.total).toEqual({ operations: 2, montantHt: 180_000, sollicite: 60_000, obtenu: 30_000, reste: 150_000 });
  });
});

import { describe, it, expect } from "vitest";
import { echeanceProche, etiquettesCategories, libelleDateLimite, trierParDateLimite } from "@/lib/aides/presentation";
import { friseSubvention, groupeSubvention, sigleDispositif } from "@/lib/projects/subventions-vue";

const now = new Date("2026-10-19T10:00:00Z");

describe("pistes de financement : présentation", () => {
  it("étiquette courte colorée par thème, sans doublon", () => {
    expect(etiquettesCategories([
      "Urbanisme / logement / aménagement / Voirie et réseaux",
      "Mobilité / transports / Mobilité partagée",
      "Urbanisme / logement / aménagement / Voirie et réseaux",
      "Énergies / Déchets / Transition énergétique",
    ], 3)).toEqual([
      { label: "Voirie et réseaux", famille: "amenagement" },
      { label: "Mobilité partagée", famille: "mobilite" },
      { label: "Transition énergétique", famille: "transition" },
    ]);
  });
  it("trie par date limite, « au fil de l'eau » à la fin", () => {
    const r = trierParDateLimite([{ id: 1, date_limite: null }, { id: 2, date_limite: "2027-03-01" }, { id: 3, date_limite: "2026-12-31" }, { id: 4, date_limite: null }]);
    expect(r.map((x) => x.id)).toEqual([3, 2, 1, 4]);
  });
  it("signale une échéance à moins de 3 mois", () => {
    expect(echeanceProche("2026-12-31", "2026-10-19")).toBe(true);
    expect(echeanceProche("2027-06-30", "2026-10-19")).toBe(false);
    expect(echeanceProche(null, "2026-10-19")).toBe(false);
    expect(libelleDateLimite("2026-12-31")).toBe("Avant le 31 déc. 2026");
  });
});

describe("demandes de subvention : présentation", () => {
  const base = { statut: "demandee", date_demande: "2026-09-01", date_ar: null, date_decision: null };
  it("regroupe par état, relance après 3 semaines sans accusé de réception", () => {
    expect(groupeSubvention(base, now)).toBe("relancer");
    expect(groupeSubvention({ ...base, date_demande: "2026-10-10" }, now)).toBe("attente_ar");
    expect(groupeSubvention({ ...base, statut: "ar_recu", date_ar: "2026-09-10" }, now)).toBe("etude");
    expect(groupeSubvention({ ...base, statut: "a_demander", date_demande: null }, now)).toBe("deposer");
    expect(groupeSubvention({ ...base, statut: "accordee" }, now)).toBe("accorde");
  });
  it("frise déposé → AR → décision", () => {
    expect(friseSubvention(base, now).map((e) => [e.etat, e.texte])).toEqual([
      ["fait", "Déposé le 1 sept. 2026"],
      ["alerte", "Sans accusé de réception depuis 6 sem."],
      ["attente", "Décision"],
    ]);
    const accordee = friseSubvention({ statut: "accordee", date_demande: "2026-05-02", date_ar: "2026-05-20", date_decision: "2026-07-01" }, now);
    expect(accordee.map((e) => e.etat)).toEqual(["fait", "fait", "fait"]);
    expect(accordee[2].texte).toBe("Accordé le 1 juil. 2026");
  });
  it("extrait le sigle du dispositif", () => {
    expect(sigleDispositif("DETR")).toEqual({ sigle: "DETR", libelle: null });
    expect(sigleDispositif("Dotation d'équipement des territoires ruraux (DETR)")).toEqual({ sigle: "DETR", libelle: "Dotation d'équipement des territoires ruraux" });
    expect(sigleDispositif("Financer des projets … dotation de soutien à l'investissement local").sigle).toBe("DSIL");
    expect(sigleDispositif("Mobilité douce")).toEqual({ sigle: null, libelle: "Mobilité douce" });
    expect(sigleDispositif(null)).toEqual({ sigle: null, libelle: null });
  });
});

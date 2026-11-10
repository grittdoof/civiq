import { describe, expect, it } from "vitest";
import {
  alertes, dangerNonPrisEnCharge, delaiMoyenJours, enRetard, indicateurs, tableau, tendance, versCsv,
  type TicketPilotage,
} from "@/lib/tickets/pilotage";

const MAINT = new Date("2026-11-07T12:00:00Z");
const t = (o: Partial<TicketPilotage>): TicketPilotage => ({
  id: Math.random().toString(36).slice(2), numero: 1, statut: "nouveau", urgence: "normale",
  created_at: "2026-11-01T12:00:00Z", pris_en_charge_at: null, clos_at: null, resolu_at: null,
  delai_cible_le: null, service_id: "voirie", categorie_id: null, categorie_racine_id: null, masque: false, ...o,
});

describe("indicateurs de pilotage", () => {
  const liste = [
    t({ statut: "en_cours", pris_en_charge_at: "2026-11-01T18:00:00Z" }),
    t({ delai_cible_le: "2026-11-05T12:00:00Z" }),
    t({ statut: "clos", created_at: "2026-11-01T12:00:00Z", clos_at: "2026-11-04T12:00:00Z" }),
    t({ statut: "clos", created_at: "2026-10-01T12:00:00Z", clos_at: "2026-10-02T12:00:00Z" }),
    t({ masque: true, urgence: "urgente" }),
  ];
  it("compte ouverts, en cours, retards, clôtures et délai moyen", () => {
    const i = indicateurs(liste, "30j", MAINT);
    expect(i.ouverts).toBe(3);
    expect(i.enCours).toBe(1);
    expect(i.enRetard).toBe(1);
    expect(i.clotures).toBe(1);
    expect(i.cloturesPrecedente).toBe(1);
    expect(i.delaiMoyen).toBe(3);
    expect(i.masques).toBe(1);
    expect(i.priseEnCharge24h).toBe(25);
  });
  it("délai moyen sans clôture : aucun", () => {
    expect(delaiMoyenJours([t({})])).toBeNull();
  });
});

describe("alertes", () => {
  it("danger non pris en charge, sans réponse, en retard ; jamais un ticket masqué", () => {
    const danger = t({ urgence: "danger_immediat", created_at: "2026-11-07T11:00:00Z" });
    const vieux = t({ created_at: "2026-10-20T12:00:00Z" });
    const retard = t({ statut: "en_cours", pris_en_charge_at: "2026-11-02T12:00:00Z", delai_cible_le: "2026-11-06T12:00:00Z" });
    const masque = t({ urgence: "danger_immediat", masque: true });
    const a = alertes([danger, vieux, retard, masque], 7, MAINT);
    expect(a.danger).toEqual([danger]);
    expect(a.sansReponse).toEqual([vieux]);
    expect(a.enRetard).toEqual([retard]);
    expect(dangerNonPrisEnCharge(t({ urgence: "danger_immediat", pris_en_charge_at: "2026-11-07T11:10:00Z", statut: "pris_en_charge" }))).toBe(false);
    expect(enRetard(t({ statut: "clos", delai_cible_le: "2026-01-01T00:00:00Z" }), MAINT)).toBe(false);
  });
});

describe("tableau par service et tendance", () => {
  it("regroupe et trie par tickets ouverts", () => {
    const lignes = tableau(
      [t({ service_id: "a" }), t({ service_id: "a" }), t({ service_id: "b" }), t({ service_id: null })],
      "30j", (x) => x.service_id, (k) => k ?? "Sans service", MAINT,
    );
    expect(lignes.map((l) => [l.libelle, l.ouverts])).toEqual([["a", 2], ["b", 1], ["Sans service", 1]]);
  });
  it("décrit la tendance", () => {
    expect(tendance(12, 3)).toEqual({ texte: "En hausse : +9", sens: "hausse" });
    expect(tendance(1, 3).texte).toBe("En baisse : −2");
    expect(tendance(2, 2).sens).toBe("stable");
  });
});

describe("export CSV", () => {
  it("échappe et encode pour Excel", () => {
    const csv = versCsv(["Service", "Ouverts"], [["Voirie; réseaux", 3], ['Dit "A"', null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Voirie; réseaux";3');
    expect(csv).toContain('"Dit ""A""";');
  });
});

describe("prise en charge (recette)", () => {
  it("compte l'assignation comme prise en charge", async () => {
    const { priseEnChargeLe } = await import("@/lib/tickets/pilotage");
    expect(priseEnChargeLe({ pris_en_charge_at: null, assigne_at: "2026-11-01T10:00:00Z" })).toBe("2026-11-01T10:00:00Z");
    expect(priseEnChargeLe({ pris_en_charge_at: "2026-11-02T10:00:00Z", assigne_at: "2026-11-01T10:00:00Z" })).toBe("2026-11-01T10:00:00Z");
    expect(priseEnChargeLe({ pris_en_charge_at: null, assigne_at: null })).toBeNull();
  });
});

describe("dépliage par catégorie et rattachement aux services", () => {
  it("liste les ouverts (urgents d'abord) puis les clôturés de la période, jamais les masqués", async () => {
    const { ticketsDeLigne } = await import("@/lib/tickets/pilotage");
    const base = { pris_en_charge_at: null, resolu_at: null, delai_cible_le: null, service_id: null, categorie_id: "c", categorie_racine_id: "c", masque: false };
    const maintenant = new Date("2026-11-10T12:00:00Z");
    const l = ticketsDeLigne([
      { ...base, id: "a", numero: 1, statut: "assigne", urgence: "normale", created_at: "2026-10-01T00:00:00Z", clos_at: null },
      { ...base, id: "b", numero: 2, statut: "nouveau", urgence: "urgente", created_at: "2026-11-01T00:00:00Z", clos_at: null },
      { ...base, id: "c", numero: 3, statut: "clos", urgence: "normale", created_at: "2026-10-20T00:00:00Z", clos_at: "2026-11-05T00:00:00Z" },
      { ...base, id: "d", numero: 4, statut: "clos", urgence: "normale", created_at: "2026-01-01T00:00:00Z", clos_at: "2026-02-01T00:00:00Z" },
      { ...base, id: "e", numero: 5, statut: "nouveau", urgence: "danger_immediat", created_at: "2026-11-02T00:00:00Z", clos_at: null, masque: true },
    ] as never, "30j", maintenant);
    expect(l.map((t: { id: string }) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("rattache au service de la catégorie ou de sa parente, jamais à un service supprimé", async () => {
    const { rattachementsParCategorie } = await import("@/lib/tickets/categories");
    const b = { icone: null, ordre: 1, actif: true, urgence_defaut: null, confidentialite_defaut: null, delai_cible_heures: null, gestionnaire_externe: null, consigne_urgence: null };
    const cats = [
      { ...b, id: "voi", parent_id: null, code: "voirie", libelle: "Voirie", service_defaut_id: "st" },
      { ...b, id: "nid", parent_id: "voi", code: "nid", libelle: "Nid", service_defaut_id: null },
      { ...b, id: "ev", parent_id: null, code: "ev", libelle: "Espaces verts", service_defaut_id: null },
      { ...b, id: "old", parent_id: null, code: "old", libelle: "Ancien", service_defaut_id: "supprime" },
    ];
    const m = rattachementsParCategorie(
      [{ id: "1", categorie_id: "nid" }, { id: "2", categorie_id: "voi" }, { id: "3", categorie_id: "ev" }, { id: "4", categorie_id: "old" }, { id: "5", categorie_id: null }],
      cats as never, new Set(["st"]),
    );
    expect([...m.entries()]).toEqual([["st", ["1", "2"]]]);
  });
});

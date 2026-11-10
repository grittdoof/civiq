import { describe, expect, it } from "vitest";
import {
  aujourdhuiParis, dateDeclenchement, echeanceSuivante, estDu, estRappelProgramme, validerRappel,
} from "@/lib/tickets/rappels";

describe("rappels programmés", () => {
  it("part à l'échéance moins l'anticipation, et rattrape un jour manqué", () => {
    expect(dateDeclenchement("2028-08-31", 30)).toBe("2028-08-01");
    expect(dateDeclenchement("2028-03-01", 1)).toBe("2028-02-29");
    const t = { statut: "en_attente", rappel_le: "2028-08-31", rappel_avance_jours: 30, rappel_envoye_at: null };
    expect(estDu(t, "2028-07-31")).toBe(false);
    expect(estDu(t, "2028-08-01")).toBe(true);
    expect(estDu(t, "2028-08-05")).toBe(true);
    expect(estDu({ ...t, rappel_envoye_at: "2028-08-01T06:00:00Z" }, "2028-08-05")).toBe(false);
    expect(estDu({ ...t, statut: "annule" }, "2028-08-05")).toBe(false);
  });

  it("n'est programmé que tant qu'il est en attente et pas parti", () => {
    expect(estRappelProgramme({ statut: "en_attente", rappel_le: "2028-08-31" })).toBe(true);
    expect(estRappelProgramme({ statut: "assigne", rappel_le: "2028-08-31", rappel_envoye_at: "2028-08-01T06:00:00Z" })).toBe(false);
    expect(estRappelProgramme({ statut: "en_attente", rappel_le: null })).toBe(false);
  });

  it("répète chaque année à la même date, jamais dans le passé", () => {
    expect(echeanceSuivante("2027-01-15", "2026-11-10")).toBe("2028-01-15");
    expect(echeanceSuivante("2028-02-29", "2026-11-10")).toBe("2029-02-28");
    expect(echeanceSuivante("2024-06-01", "2026-11-10")).toBe("2027-06-01");
  });

  it("contrôle la saisie", () => {
    const ok = validerRappel({ titre: "  Résilier   la location ", rappel_le: "2028-08-31", avance_jours: 90, repetition: "aucune" }, "2026-11-10");
    expect(ok).toEqual({ titre: "Résilier la location", description: null, rappel_le: "2028-08-31", avance_jours: 90, repetition: "aucune" });
    expect(() => validerRappel({ titre: "Ok ok", rappel_le: "2026-11-09" }, "2026-11-10")).toThrow(/passée/);
    expect(() => validerRappel({ titre: "Ok ok", rappel_le: "2026-13-40" }, "2026-11-10")).toThrow();
    expect(() => validerRappel({ titre: "Ok ok", rappel_le: "2027-01-01", avance_jours: 12 }, "2026-11-10")).toThrow(/Anticipation/);
    expect(() => validerRappel({ titre: "Ok ok", rappel_le: "2027-01-01", repetition: "mensuelle" }, "2026-11-10")).toThrow(/Répétition/);
    expect(() => validerRappel({ titre: "x", rappel_le: "2027-01-01" }, "2026-11-10")).toThrow(/Titre/);
  });

  it("écrit le premier du mois « 1er »", async () => {
    const { formatJour } = await import("@/lib/tickets/rappels");
    expect(formatJour("2028-08-01")).toBe("1er août 2028");
    expect(formatJour("2028-08-31")).toBe("31 août 2028");
  });

  it("date du jour à Paris", () => {
    expect(aujourdhuiParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

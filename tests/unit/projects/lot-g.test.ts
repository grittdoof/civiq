import { describe, it, expect } from "vitest";
import { erreurConversion, etatPasserelle, lienConversion, verrouilleParProjet } from "@/lib/projects/passerelle";
import { buildSignalementConvertiEmail } from "@/lib/emails/signalement-converti";
import { CLOTURE_STATUTS, groupOf, STATUT_LABELS } from "@/lib/tickets/types";

const projet = { id: "p1", titre: "Réfection de la rue", deleted_at: null };

describe("passerelle signalement → projet", () => {
  it("propose la conversion d'un signalement sans projet", () => {
    expect(etatPasserelle({ statut: "nouveau", project_id: null }, null, false)).toEqual({ kind: "convertible" });
  });
  it("montre le projet lié quand il est visible", () => {
    expect(etatPasserelle({ statut: "converti_en_projet", project_id: "p1" }, projet, true))
      .toEqual({ kind: "lie", projetId: "p1", titre: "Réfection de la rue", corbeille: false });
  });
  it("ne révèle ni titre ni lien d'un projet confidentiel", () => {
    const e = etatPasserelle({ statut: "converti_en_projet", project_id: "p1" }, projet, false);
    expect(e).toEqual({ kind: "lie_confidentiel" });
    expect(JSON.stringify(e)).not.toContain("Réfection");
  });
  it("signale un projet en corbeille", () => {
    const e = etatPasserelle({ statut: "converti_en_projet", project_id: "p1" }, { ...projet, deleted_at: "2026-10-01" }, true);
    expect(e).toMatchObject({ kind: "lie", corbeille: true });
  });
  it("converti mais projet purgé : réouverture et nouvelle conversion possibles", () => {
    expect(etatPasserelle({ statut: "converti_en_projet", project_id: null }, null, false)).toEqual({ kind: "projet_supprime" });
    expect(verrouilleParProjet({ statut: "converti_en_projet", project_id: null })).toBe(false);
    expect(verrouilleParProjet({ statut: "converti_en_projet", project_id: "p1" })).toBe(true);
  });
  it("passe par l'assistant (choix du type)", () => {
    expect(lienConversion("abc")).toBe("/admin/projects/nouveau?from_ticket=abc");
  });
  it("traduit les refus de la base", () => {
    expect(erreurConversion("Ce signalement est déjà rattaché à un projet")).toBe("Ce signalement est déjà rattaché à un projet.");
    expect(erreurConversion("Ticket introuvable")).toBe("Ce signalement est introuvable.");
    expect(erreurConversion("autre chose")).toBeNull();
    expect(erreurConversion(undefined)).toBeNull();
  });
});

describe("statut « converti en projet »", () => {
  it("sort de la file active", () => {
    expect(groupOf("converti_en_projet")).toBe("cloture");
    expect(CLOTURE_STATUTS).toContain("converti_en_projet");
    expect(STATUT_LABELS.converti_en_projet).toBe("Converti en projet");
  });
});

describe("email au demandeur", () => {
  const base = {
    siteUrl: "https://www.gociviq.fr",
    commune: { name: "Châteauneuf", phone: "02 00 00 00 00", contact_email: "mairie@example.fr" },
    demandeurNom: "Camille <b>",
    numero: 42,
    titre: "Trottoir dangereux",
    dateSignalement: "2026-09-12T08:00:00.000Z",
  };
  it("reprend le signalement sans aucun détail du projet", () => {
    const m = buildSignalementConvertiEmail(base);
    expect(m.subject).toContain("n° 42 « Trottoir dangereux »");
    expect(m.html).toContain("12 septembre 2026");
    expect(m.html).not.toMatch(/budget de|€|élu référent/i);
    expect(m.text).toContain("Mairie de Châteauneuf");
  });
  it("échappe le nom du demandeur", () => {
    const m = buildSignalementConvertiEmail(base);
    expect(m.html).toContain("Camille &lt;b&gt;");
    expect(m.html).not.toContain("Camille <b>");
  });
});

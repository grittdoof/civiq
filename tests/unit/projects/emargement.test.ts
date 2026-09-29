import { describe, expect, it } from "vitest";
import { listeEmargement, peutPointer, repartition, statutDe, type LigneSource, type MembreSource } from "@/lib/projects/emargement";

const m = (o: Partial<MembreSource> & { id: string }): MembreSource => ({ user_id: null, role: "membre", external_name: null, deleted_at: null, profile: null, ...o });
const l = (o: Partial<LigneSource>): LigneSource => ({ conseiller_user_id: null, commission_member_id: null, present: null, statut: null, signature_data: null, signe_le: null, ...o });

describe("émargement : tous les membres figurent", () => {
  const membres = [
    m({ id: "m1", user_id: "u1", profile: { full_name: "Claire Martin" }, role: "president" }),
    m({ id: "m2", user_id: "u2", profile: { full_name: "Bruno Petit" } }),
    m({ id: "m3", external_name: "Anne Externe" }),
    m({ id: "m4", user_id: "u4", profile: { full_name: "Parti Depuis" }, deleted_at: "2026-09-01T00:00:00Z" }),
    m({ id: "m5", user_id: "u5", profile: { full_name: "Parti Sans Trace" }, deleted_at: "2026-09-01T00:00:00Z" }),
  ];

  it("séance créée sans convocation ni pointage : tous les membres actifs, « non renseigné »", () => {
    const liste = listeEmargement(membres, []);
    expect(liste.map((e) => e.nom)).toEqual(["Claire Martin", "Anne Externe", "Bruno Petit"]);
    expect(liste.every((e) => e.statut === null)).toBe(true);
    expect(repartition(liste).nonRenseignes.length).toBe(3);
  });

  it("trois statuts, et l'ancien booléen present reste compris", () => {
    const liste = listeEmargement(membres, [
      l({ conseiller_user_id: "u1", statut: "present", present: true }),
      l({ conseiller_user_id: "u2", present: false }),
      l({ commission_member_id: "m3", statut: "excuse", present: false }),
    ]);
    const r = repartition(liste);
    expect(r).toEqual({ presents: ["Claire Martin"], excuses: ["Anne Externe"], absents: ["Bruno Petit"], nonRenseignes: [] });
  });

  it("un membre parti mais inscrit à la séance reste dans l'historique", () => {
    const liste = listeEmargement(membres, [l({ conseiller_user_id: "u4", statut: "present" })]);
    const parti = liste.find((e) => e.user_id === "u4")!;
    expect(parti).toMatchObject({ ancien: true, statut: "present", nom: "Parti Depuis" });
    expect(liste[liste.length - 1].user_id).toBe("u4");
    expect(liste.some((e) => e.user_id === "u5")).toBe(false);
  });

  it("ligne orpheline (fiche membre supprimée) conservée", () => {
    const liste = listeEmargement([], [l({ conseiller_user_id: "u9", statut: "absent", profile: { full_name: "Zoé" } })]);
    expect(liste[0]).toMatchObject({ nom: "Zoé", ancien: true, statut: "absent" });
  });

  it("statutDe", () => {
    expect(statutDe(undefined)).toBeNull();
    expect(statutDe({ statut: null, present: true })).toBe("present");
    expect(statutDe({ statut: "excuse", present: false })).toBe("excuse");
  });

  it("pointer : gestionnaires et secrétaire pour tous, un élu pour lui-même", () => {
    const cible = { user_id: "u2" };
    expect(peutPointer({ role: "editor", userId: "x", secretaireId: null, cible })).toBe(true);
    expect(peutPointer({ role: "viewer", userId: "sec", secretaireId: "sec", cible })).toBe(true);
    expect(peutPointer({ role: "viewer", userId: "u2", secretaireId: null, cible })).toBe(true);
    expect(peutPointer({ role: "viewer", userId: "x", secretaireId: null, cible })).toBe(false);
  });
});

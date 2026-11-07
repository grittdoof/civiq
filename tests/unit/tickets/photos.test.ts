import { describe, expect, it } from "vitest";
import { cheminPhotoValide, verifierCheminsPhotos } from "@/lib/tickets/photos";

const COMMUNE = "86ab6d80-e101-4d2d-9673-7fd71474e775";
const AUTRE = "11111111-2222-3333-4444-555555555555";
const PHOTO = "faf1bc04-10ac-4d89-a876-3c158373e196.jpg";

describe("cheminPhotoValide", () => {
  it("accepte une photo du dossier de la commune", () => {
    expect(cheminPhotoValide(`${COMMUNE}/${PHOTO}`, COMMUNE)).toBe(true);
  });
  it("refuse une photo d'une autre commune", () => {
    expect(cheminPhotoValide(`${AUTRE}/${PHOTO}`, COMMUNE)).toBe(false);
  });
  it("refuse les chemins forgés", () => {
    for (const c of [
      `${COMMUNE}/../${AUTRE}/${PHOTO}`,
      `${COMMUNE}/sous/${PHOTO}`,
      `${COMMUNE}/rapport.pdf`,
      `${COMMUNE}/`,
      PHOTO,
      "",
    ]) {
      expect(cheminPhotoValide(c, COMMUNE)).toBe(false);
    }
    expect(cheminPhotoValide(42, COMMUNE)).toBe(false);
  });
  it("refuse tout chemin sans commune connue", () => {
    expect(cheminPhotoValide(`${COMMUNE}/${PHOTO}`, null)).toBe(false);
  });
});

describe("verifierCheminsPhotos", () => {
  it("laisse passer une liste valide ou vide", () => {
    expect(verifierCheminsPhotos([`${COMMUNE}/${PHOTO}`], COMMUNE)).toHaveLength(1);
    expect(verifierCheminsPhotos(undefined, COMMUNE)).toEqual([]);
  });
  it("lève une erreur au premier chemin étranger", () => {
    expect(() => verifierCheminsPhotos([`${COMMUNE}/${PHOTO}`, `${AUTRE}/${PHOTO}`], COMMUNE)).toThrow(/commune/);
  });
});

import { describe, expect, it } from "vitest";
import {
  cheminMiniature, demandeTelechargement, genrePiece, nomFichier, ouvrirDansNavigateur,
  trouverDocument, urlDocument, urlPhoto,
} from "@/lib/tickets/pieces";
import { estCheminRapportValide } from "@/lib/tickets/documents-rapport";

const C = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const T = "33333333-3333-3333-3333-333333333333";
const P = "44444444-4444-4444-4444-444444444444";

describe("pièces jointes : adresses stables", () => {
  it("construit l'adresse d'une photo, en grand, en miniature ou à télécharger", () => {
    expect(urlPhoto(T, P)).toBe(`/api/tickets/${T}/photos/${P}`);
    expect(urlPhoto(T, P, { miniature: true })).toBe(`/api/tickets/${T}/photos/${P}?taille=miniature`);
    expect(urlPhoto(T, P, { telecharger: true })).toBe(`/api/tickets/${T}/photos/${P}?telecharger=1`);
  });

  it("construit l'adresse d'un document à partir de son seul nom de fichier", () => {
    const chemin = `tickets/${C}/rapports/abc_Devis-élagage.pdf`;
    expect(nomFichier(chemin)).toBe("abc_Devis-élagage.pdf");
    expect(urlDocument(T, chemin)).toBe(`/api/tickets/${T}/documents/${encodeURIComponent("abc_Devis-élagage.pdf")}`);
    expect(urlDocument(T, chemin, { telecharger: true })).toMatch(/\?telecharger=1$/);
  });

  it("lit la demande de téléchargement", () => {
    expect(demandeTelechargement(new URLSearchParams("telecharger=1"))).toBe(true);
    expect(demandeTelechargement(new URLSearchParams("telecharger=0"))).toBe(false);
    expect(demandeTelechargement(new URLSearchParams(""))).toBe(false);
  });
});

describe("pièces jointes : affichage", () => {
  it("ouvre images et PDF dans le navigateur, télécharge le reste", () => {
    expect(genrePiece("photo.JPG")).toBe("image");
    expect(genrePiece("rapport.pdf")).toBe("pdf");
    expect(genrePiece("devis.docx")).toBe("fichier");
    expect(ouvrirDansNavigateur("rapport.PDF")).toBe(true);
    expect(ouvrirDansNavigateur("tableau.xlsx")).toBe(false);
    expect(ouvrirDansNavigateur("sans-extension")).toBe(false);
  });

  it("range la miniature sous le dossier de la commune", () => {
    expect(cheminMiniature(`${C}/${P}.jpg`)).toBe(`${C}/miniatures/${P}.jpg`);
    expect(cheminMiniature(`${C}/miniatures/${P}.jpg`)).toBeNull();
    expect(cheminMiniature(`${P}.jpg`)).toBeNull();
  });
});

describe("pièces jointes : contrôle des documents demandés", () => {
  const valide = (c: string) => estCheminRapportValide(c, C);
  const chemins = [
    `tickets/${C}/rapports/aaa_Facture.pdf`,
    `tickets/${AUTRE}/rapports/bbb_Intrus.pdf`,
  ];

  it("ne sert qu'un document enregistré sur le rapport et de la bonne commune", () => {
    expect(trouverDocument(chemins, "aaa_Facture.pdf", valide)).toBe(chemins[0]);
    expect(trouverDocument(chemins, "bbb_Intrus.pdf", valide)).toBeNull();
    expect(trouverDocument(chemins, "inconnu.pdf", valide)).toBeNull();
    expect(trouverDocument(null, "aaa_Facture.pdf", valide)).toBeNull();
  });

  it("refuse les noms qui tentent de sortir du dossier", () => {
    expect(trouverDocument(chemins, "../aaa_Facture.pdf", valide)).toBeNull();
    expect(trouverDocument(chemins, `rapports/aaa_Facture.pdf`, valide)).toBeNull();
    expect(trouverDocument(chemins, "", valide)).toBeNull();
  });
});

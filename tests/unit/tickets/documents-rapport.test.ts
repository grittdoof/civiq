import { describe, expect, it } from "vitest";
import {
  ACCEPT_DOCUMENT_RAPPORT, cheminDocumentRapport, estCheminRapportValide,
  mimeDocumentRapport, nomAffichable, nomAscii, prefixeRapports,
} from "@/lib/tickets/documents-rapport";

const C = "11111111-1111-1111-1111-111111111111";
const AUTRE = "22222222-2222-2222-2222-222222222222";
const U = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("pièces jointes du rapport de clôture", () => {
  it("déduit le type MIME de l'extension, liste blanche", () => {
    expect(mimeDocumentRapport("Rapport.PDF")).toBe("application/pdf");
    expect(mimeDocumentRapport("devis.docx")).toContain("wordprocessingml");
    expect(mimeDocumentRapport("tableau.ods")).toBe("application/vnd.oasis.opendocument.spreadsheet");
    expect(mimeDocumentRapport("photo.svg")).toBeNull();
    expect(mimeDocumentRapport("script.html")).toBeNull();
    expect(mimeDocumentRapport("sans-extension")).toBeNull();
    expect(ACCEPT_DOCUMENT_RAPPORT).toContain(".pdf");
  });

  it("choisit le chemin sous tickets/<commune>/rapports/ et garde un nom lisible", () => {
    const path = cheminDocumentRapport(C, "Facture plombier – été.pdf", U);
    expect(path).toBe(`tickets/${C}/rapports/${U}_Facture-plombier-ete.pdf`);
    expect(nomAffichable(path!)).toBe("Facture-plombier-ete.pdf");
    expect(cheminDocumentRapport(C, "image.svg", U)).toBeNull();
  });

  it("neutralise les noms hostiles", () => {
    expect(nomAscii("../../etc/passwd.pdf")).toBe("etc-passwd");
    expect(nomAscii("???.pdf")).toBe("document");
    expect(nomAscii("a".repeat(200) + ".pdf").length).toBeLessThanOrEqual(60);
  });

  it("n'accepte qu'un chemin de la commune, sans sous-dossier ni remontée", () => {
    const ok = `${prefixeRapports(C)}${U}_rapport.pdf`;
    expect(estCheminRapportValide(ok, C)).toBe(true);
    expect(estCheminRapportValide(ok, AUTRE)).toBe(false);
    expect(estCheminRapportValide(`${prefixeRapports(C)}x/y.pdf`, C)).toBe(false);
    expect(estCheminRapportValide(`${prefixeRapports(C)}../${AUTRE}.pdf`, C)).toBe(false);
    expect(estCheminRapportValide(`${prefixeRapports(C)}${U}_page.html`, C)).toBe(false);
    expect(estCheminRapportValide(prefixeRapports(C), C)).toBe(false);
    expect(estCheminRapportValide(42, C)).toBe(false);
  });

  it("affiche le nom brut d'un chemin d'un autre format", () => {
    expect(nomAffichable("tickets/c/rapports/1700000000-abc.pdf")).toBe("1700000000-abc.pdf");
  });
});

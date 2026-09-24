import { describe, it, expect } from "vitest";
import { isRichHtml, parseRichText, plainTextToHtml, toRichHtml } from "@/lib/projects/rich-text";
import { buildMinutesEmail } from "@/lib/emails/commission-minutes";

describe("plainTextToHtml / toRichHtml", () => {
  it("convertit un compte rendu texte legacy en paragraphes échappés", () => {
    expect(plainTextToHtml("Présents : A & B\nExcusé : C\n\n1. <PLU>")).toBe(
      "<p>Présents : A &amp; B<br>Excusé : C</p><p>1. &lt;PLU&gt;</p>",
    );
  });
  it("laisse le HTML riche intact", () => {
    const html = "<p><b>ok</b></p>";
    expect(isRichHtml(html)).toBe(true);
    expect(toRichHtml(html)).toBe(html);
  });
  it("gère vide / null", () => {
    expect(toRichHtml(null)).toBe("");
    expect(parseRichText("")).toEqual([]);
  });
});

describe("parseRichText", () => {
  it("titres, paragraphes et styles imbriqués", () => {
    const blocks = parseRichText("<h2>Titre</h2><p>Un <b>gras <i>et italique</i></b> <u>souligné</u></p>");
    expect(blocks[0]).toEqual({ type: "h2", runs: [{ text: "Titre", bold: false, italic: false, underline: false }] });
    expect(blocks[1].type).toBe("p");
    expect(blocks[1].runs).toEqual([
      { text: "Un ", bold: false, italic: false, underline: false },
      { text: "gras ", bold: true, italic: false, underline: false },
      { text: "et italique", bold: true, italic: true, underline: false },
      { text: " ", bold: false, italic: false, underline: false },
      { text: "souligné", bold: false, italic: false, underline: true },
    ]);
  });
  it("listes numérotées et à puces", () => {
    const blocks = parseRichText("<ol><li>Un</li><li>Deux</li></ol><ul><li>Puce</li></ul>");
    expect(blocks.map((b) => [b.type, b.ordered, b.index])).toEqual([
      ["li", true, 1],
      ["li", true, 2],
      ["li", false, 1],
    ]);
  });
  it("texte hors bloc (contenteditable) + <br> + entités", () => {
    const blocks = parseRichText("Ligne 1<br>Ligne&nbsp;2 &amp; fin<p>Suite</p>");
    expect(blocks[0].runs.map((r) => r.text).join("")).toBe("Ligne 1\nLigne 2 & fin");
    expect(blocks[1].runs[0].text).toBe("Suite");
  });
  it("un <p> collé dans un <li> ne casse pas l'item", () => {
    const blocks = parseRichText("<ul><li><p>Point</p></li></ul>");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("li");
  });
  it("texte legacy", () => {
    const blocks = parseRichText("Premier\n\nSecond");
    expect(blocks.map((b) => b.runs[0].text)).toEqual(["Premier", "Second"]);
  });
});

describe("buildMinutesEmail", () => {
  const { html, subject, text } = buildMinutesEmail({
    siteUrl: "https://www.gociviq.fr",
    commune: { name: "Châteauneuf", address: "1 place de la Mairie" },
    commissionName: "Urbanisme",
    recipientName: "Jeanne",
    dateLabel: "Jeudi 1 octobre 2026 à 18h30",
    message: "Bonne lecture <b>!</b>\nCordialement",
    senderName: "Paul",
    pdfFilename: "compte-rendu-urbanisme-2026-10-01.pdf",
  });
  it("contenu, échappement du message et pièce jointe annoncée", () => {
    expect(subject).toBe("Compte rendu : Urbanisme — séance du Jeudi 1 octobre 2026 à 18h30");
    expect(html).toContain("Message de Paul");
    expect(html).toContain("Bonne lecture &lt;b&gt;!&lt;/b&gt;<br>Cordialement");
    expect(html).toContain("compte-rendu-urbanisme-2026-10-01.pdf");
    expect(html).toContain("1 place de la Mairie");
    expect(html).toContain("/brand/logo-horizontal.png");
    expect(text).toContain("Pièce jointe : compte-rendu-urbanisme-2026-10-01.pdf");
  });
});

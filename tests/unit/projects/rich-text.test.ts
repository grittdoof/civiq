import { describe, it, expect } from "vitest";
import { isRichHtml, parseRichText, plainTextToHtml, sanitizeRichText, toRichHtml } from "@/lib/projects/rich-text";
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
    // Hors liste, <br> ouvre un nouveau paragraphe (voir « PDF : listes… »).
    const blocks = parseRichText("Ligne 1<br>Ligne&nbsp;2 &amp; fin<p>Suite</p>");
    expect(blocks.map((b) => b.runs.map((r) => r.text).join(""))).toEqual(["Ligne 1", "Ligne 2 & fin", "Suite"]);
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

describe("sanitizeRichText", () => {
  const payloads = [
    "<img/src=x onerror=alert(1)>",
    "<img src=x onerror=alert(1)>",
    '<p onclick="alert(1)">x</p>',
    "<svg><script>alert(1)</script></svg>",
    "<a href=javascript:alert(1)>x</a>",
    '<p title=">"<img src=x onerror=alert(1)>">x</p>',
    "<scr<script>ipt>alert(1)</script>",
    "<img src=x onerror=alert(1)",
    "<IMG SRC=x OnError=alert(1)>",
    "<details open ontoggle=alert(1)>",
  ];
  it.each(payloads)("neutralise %s", (p) => {
    const out = sanitizeRichText(p);
    // Aucune balise hors liste blanche ne subsiste, aucun attribut.
    expect(out).not.toMatch(/<(?!\/?(p|br|strong|b|em|i|u|h[1-4]|ul|ol|li)>)/i);
    expect(out).not.toMatch(/<[a-z0-9]+\s/i);
  });
  it("conserve la mise en forme autorisée en retirant les attributs", () => {
    expect(sanitizeRichText('<p style="color:red"><strong class="x">Ordre</strong> du jour<br/></p>'))
      .toBe("<p><strong>Ordre</strong> du jour<br></p>");
    expect(sanitizeRichText("<H2>Titre</H2><ul><li>a</li></ul>")).toBe("<h2>Titre</h2><ul><li>a</li></ul>");
  });
  it("supprime les balises inconnues en gardant leur texte", () => {
    expect(sanitizeRichText('<span style="x">texte</span>')).toBe("texte");
  });
  it("échappe les chevrons isolés du texte", () => {
    expect(sanitizeRichText("<p>1 < 2 et 3 > 2</p>")).toBe("<p>1 &lt; 2 et 3 &gt; 2</p>");
  });
  it("toRichHtml ré-assainit un contenu déjà stocké", () => {
    expect(toRichHtml("<p>ok<img/src=x onerror=alert(1)></p>")).toBe("<p>ok</p>");
  });
});

import { marquerListesManuelles, parseRichText as parse2 } from "@/lib/projects/rich-text";

describe("PDF : listes et retours à la ligne comme à l'écran", () => {
  it("liste aux numéros saisis à la main : aucun marqueur automatique", () => {
    const b = parse2("<ol><li>1. Validation du règlement</li><li>suite de la ligne</li><li>2. Cérémonie</li></ol>");
    expect(b.filter((x) => x.type === "li").map((x) => x.marker)).toEqual([null, null, null]);
  });
  it("tirets et « + » comptent comme marqueurs manuels", () => {
    const b = parse2("<ul><li>- Sentier rando</li><li>+ Questions</li></ul>");
    expect(b.every((x) => x.marker === null)).toBe(true);
  });
  it("liste ordinaire : numéros et puces automatiques", () => {
    expect(parse2("<ol><li>Alpha</li><li>Bêta</li></ol>").map((x) => x.marker)).toEqual(["1.", "2."]);
    expect(parse2("<ul><li>Alpha</li></ul>")[0].marker).toBe("•");
  });
  it("<br> hors liste : nouveau paragraphe (l'italique ne se mêle plus au titre suivant)", () => {
    const b = parse2("<i>Présentation</i><i><br></i><b><u>Communication</u></b>");
    expect(b.map((x) => x.runs.map((r) => r.text).join(""))).toEqual(["Présentation", "Communication"]);
    expect(b[0].runs[0].italic).toBe(true);
  });
  it("<br> dans un élément de liste : simple retour à la ligne", () => {
    const b = parse2("<ul><li>ligne 1<br>ligne 2</li></ul>");
    expect(b).toHaveLength(1);
    expect(b[0].runs.map((r) => r.text).join("")).toBe("ligne 1\nligne 2");
  });
  it("écran : classe pj-rich-manuel sur les listes numérotées à la main", () => {
    expect(marquerListesManuelles("<ol><li>1. A</li></ol><ul><li>B</li></ul>")).toBe('<ol class="pj-rich-manuel"><li>1. A</li></ol><ul><li>B</li></ul>');
  });
});

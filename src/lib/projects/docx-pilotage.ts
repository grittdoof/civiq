// ═══════════════════════════════════════════════════════════════
// Word (.docx) du lot F : fiche projet A4 et reporting — de vrais
// documents éditables (bibliothèque `docx`), pas des PDF renommés.
// Le reporting utilise une vraie liste à puces à trois niveaux
// (• / ◦ / ▪) : la tabulation reste modifiable dans Word.
// Logo de la commune en en-tête, petit logo GoCiviq en pied de page.
// ═══════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { eur, pct, VARIANTE_LABEL, type FicheData } from "./fiche";
import type { ReportingProjet } from "./pilotage";

const FONT = "Arial";
const MARINE = "042F64";
const MUTED = "6B7080";
const DANGER = "E00114";
const CONTENT_WIDTH = 9638; // A4, marges 2 cm (DXA)

export interface EnveloppeDocx {
  communeName: string;
  communeLogoUrl: string | null;
  editedOn: string;
}

type Img = { data: Buffer; type: "png" | "jpg"; width: number; height: number };

/** Dimensions d'un PNG ou d'un JPEG (sans dépendance). */
export function dimensionsImage(buf: Buffer): { type: "png" | "jpg"; width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function chargerImage(url: string | null): Promise<Img | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    const dim = dimensionsImage(data);
    return dim ? { data, ...dim } : null;
  } catch {
    return null;
  }
}

function logoGociviq(): Img | null {
  const p = path.join(process.cwd(), "public", "brand", "logo-horizontal.png");
  if (!fs.existsSync(p)) return null;
  const data = fs.readFileSync(p);
  const dim = dimensionsImage(data);
  return dim ? { data, ...dim } : null;
}

function imageRun(img: Img, hauteur: number, largeurMax: number): ImageRun {
  let h = hauteur;
  let w = (img.width / img.height) * h;
  if (w > largeurMax) { w = largeurMax; h = (img.height / img.width) * w; }
  return new ImageRun({ type: img.type, data: img.data, transformation: { width: Math.round(w), height: Math.round(h) } });
}

async function enTetePied(env: EnveloppeDocx, typeDoc: string) {
  const logo = await chargerImage(env.communeLogoUrl);
  const gociviq = logoGociviq();
  const header = new Header({
    children: [
      new Paragraph({
        children: [
          ...(logo ? [imageRun(logo, 42, 140), new TextRun({ text: "   " })] : []),
          new TextRun({ text: env.communeName, bold: true, size: 24, font: FONT, color: "111827" }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: `${typeDoc} — édité le ${env.editedOn}`, size: 16, font: FONT, color: MUTED })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 4 } },
        spacing: { after: 120 },
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: `${env.communeName} — ${typeDoc}. Données traitées conformément au RGPD.   `, size: 14, font: FONT, color: "9CA3AF" }),
          ...(gociviq ? [imageRun(gociviq, 14, 60)] : [new TextRun({ text: "GoCiviq", size: 14, font: FONT, color: "9CA3AF" })]),
        ],
      }),
    ],
  });
  return { header, footer };
}

const txt = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 19, bold: o.bold, color: o.color, italics: o.italics });

const titreSection = (t: string) =>
  new Paragraph({
    children: [txt(t, { bold: true, size: 22, color: MARINE })],
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 2 } },
  });

function tableau(entetes: string[], largeurs: number[], lignes: Array<Array<{ text: string; color?: string; bold?: boolean; sous?: string }>>): Table {
  const w = largeurs.map((x) => Math.round((x / 100) * CONTENT_WIDTH));
  const cell = (c: { text: string; color?: string; bold?: boolean; sous?: string }, i: number, head = false) =>
    new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: "F2F3F7" } : undefined,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [
        new Paragraph({ children: [txt(c.text, { bold: head || c.bold, size: head ? 16 : 18, color: head ? MUTED : c.color })] }),
        ...(c.sous ? [new Paragraph({ children: [txt(c.sous, { size: 15, color: MUTED })] })] : []),
      ],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: entetes.map((e, i) => cell({ text: e }, i, true)) }),
      ...lignes.map((l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cell(c, i)) })),
    ],
  });
}

const kpis = (items: Array<[string, string, string?]>) =>
  tableau(items.map((i) => i[0]), items.map(() => 100 / items.length), [items.map(([, v, color]) => ({ text: v, bold: true, color }))]);

export async function ficheDocx(fiche: FicheData, env: EnveloppeDocx): Promise<Buffer> {
  const typeDoc = `Fiche projet — ${VARIANTE_LABEL[fiche.variante]}`;
  const { header, footer } = await enTetePied(env, typeDoc);
  const photo = await chargerImage(fiche.photoUrl);
  const b = fiche.budget;
  const children: Array<Paragraph | Table> = [];

  if (fiche.confidentiel) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [txt("PROJET CONFIDENTIEL — diffusion réservée au bureau municipal", { bold: true, size: 16, color: DANGER })],
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: DANGER }, bottom: { style: BorderStyle.SINGLE, size: 6, color: DANGER } },
      spacing: { after: 160 },
    }));
  }
  children.push(new Paragraph({ children: [txt(fiche.typeLabel.toUpperCase(), { bold: true, size: 15, color: MARINE })] }));
  children.push(new Paragraph({ children: [txt(fiche.titre, { bold: true, size: 34, color: MARINE })], spacing: { after: 80 } }));
  children.push(new Paragraph({ children: [txt(`Commission : ${fiche.commission ?? "—"}   ·   Élu référent : ${fiche.referent ?? "à désigner"}`, { size: 17, color: MUTED })] }));
  if (fiche.evenement?.date) {
    children.push(new Paragraph({ children: [txt(`Date : ${fiche.evenement.date}${fiche.evenement.lieu ? `   ·   Lieu : ${fiche.evenement.lieu}` : ""}`, { size: 17, color: MUTED })] }));
  }
  if (photo) children.push(new Paragraph({ children: [imageRun(photo, 150, 300)], spacing: { before: 120 } }));
  if (fiche.description) children.push(new Paragraph({ children: [txt(fiche.description)], spacing: { before: 120 } }));
  children.push(new Paragraph({
    children: [txt(`Avancement : ${fiche.avancement === null ? "non renseigné" : pct(Math.round(fiche.avancement))}`, { bold: true })],
    spacing: { before: 120 },
  }));

  children.push(titreSection(fiche.etapesTitre));
  if (fiche.etapes.length === 0) children.push(new Paragraph({ children: [txt("Aucune étape saisie.")] }));
  else children.push(tableau(["Étape", "Date", "Statut"], [48, 30, 22], fiche.etapes.map((e) => [
    { text: `${e.jalon ? "Jalon — " : ""}${e.libelle}`, sous: e.commentaire ? `${e.noteInterne ? "Note interne : " : ""}${e.commentaire}` : undefined },
    { text: e.date ?? "—" },
    e.enRetard ? { text: "En retard", color: DANGER, bold: true } : { text: e.statut },
  ])));
  if (fiche.etapesMasquees > 0) {
    children.push(new Paragraph({ children: [txt(`+ ${fiche.etapesMasquees} autre(s) étape(s) : voir le projet dans GoCiviq.`, { size: 15, color: MUTED, italics: true })] }));
  }

  if (b?.kind === "investissement") {
    children.push(titreSection("Budget et plan de financement (hors taxes)"));
    children.push(kpis([["Prévu", eur(b.prevuHt)], ["Engagé", eur(b.engageHt)], ["Payé", eur(b.mandateHt)]]));
    children.push(new Paragraph({ children: [] }));
    children.push(kpis([["Aides publiques retenues", eur(b.plan.aides_retenues)], ["FCTVA estimé", eur(b.plan.fctva)], ["Emprunt", eur(b.plan.emprunt)]]));
    children.push(new Paragraph({ children: [] }));
    children.push(kpis([
      ["Part communale (20 % minimum)", `${pct(b.plan.part_commune_pct)}${b.plan.controle_part_commune_ok === false ? " — insuffisante" : ""}`, b.plan.controle_part_commune_ok === false ? DANGER : undefined],
      ["Aides publiques (80 % maximum)", `${pct(b.plan.aides_pct)}${b.plan.controle_aides_ok === false ? " — plafond dépassé" : ""}`, b.plan.controle_aides_ok === false ? DANGER : undefined],
    ]));
  } else if (b?.kind === "fonctionnement") {
    children.push(titreSection("Budget de fonctionnement (TTC)"));
    children.push(kpis([["Dépenses", eur(b.depensesTtc)], ["Recettes", eur(b.recettesTtc)], ["Solde", eur(b.soldeTtc), b.soldeTtc < 0 ? DANGER : undefined]]));
  }

  if (fiche.subventions.length) {
    children.push(titreSection("Subventions"));
    children.push(tableau(["Financeur", "Statut", "Demandé", "Obtenu"], [44, 24, 16, 16],
      fiche.subventions.map((x) => [{ text: x.financeur }, { text: x.statut }, { text: eur(x.demande) }, { text: eur(x.obtenu) }])));
  }
  if (fiche.deliberations.length) {
    children.push(titreSection("Délibérations"));
    for (const d of fiche.deliberations) {
      children.push(new Paragraph({ children: [txt(`N° ${d.numero ?? "—"}${d.date ? ` du ${d.date}` : ""}${d.objet ? ` — ${d.objet}` : ""}`)] }));
    }
  }
  if (fiche.documents.length) {
    children.push(titreSection("Pièces du dossier"));
    children.push(new Paragraph({ children: [txt(fiche.documents.map((d) => `${d.nom}${d.noteInterne ? " (interne)" : ""}`).join("  ·  "))] }));
  }
  children.push(new Paragraph({
    children: [txt(fiche.variante === "communicable"
      ? "Version communicable : les notes et pièces internes sont exclues."
      : "Version complète à usage interne : contient des notes internes, ne pas diffuser en l'état.", { size: 15, color: MUTED, italics: true })],
    spacing: { before: 200 },
  }));

  const doc = new Document({
    creator: env.communeName,
    title: `${fiche.titre} — fiche projet`,
    styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

export async function reportingDocx(items: ReportingProjet[], filtres: string, env: EnveloppeDocx): Promise<Buffer> {
  const { header, footer } = await enTetePied(env, "Reporting des projets");
  const puce = (level: 0 | 1 | 2, text: string) =>
    new Paragraph({
      numbering: { reference: "reporting", level },
      spacing: { before: level === 0 ? 200 : 40 },
      children: [txt(text, { bold: level === 0, size: level === 0 ? 21 : level === 1 ? 19 : 18 })],
    });
  const children: Paragraph[] = [
    new Paragraph({ children: [txt("Reporting des projets", { bold: true, size: 32, color: MARINE })] }),
    new Paragraph({ children: [txt(filtres, { size: 17, color: MUTED })], spacing: { after: 120 } }),
  ];
  if (items.length === 0) children.push(new Paragraph({ children: [txt("Aucune étape n'est marquée « remonter au reporting » pour ces filtres.")] }));
  for (const p of items) {
    children.push(puce(0, p.titre));
    for (const l of p.lignes) {
      children.push(puce(1, l.texte));
      for (const x of l.sous) children.push(puce(2, x));
    }
  }
  const niveau = (level: number, text: string) => ({
    level,
    format: LevelFormat.BULLET,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } }, run: { font: FONT } },
  });
  const doc = new Document({
    creator: env.communeName,
    title: "Reporting des projets",
    styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    numbering: { config: [{ reference: "reporting", levels: [niveau(0, "•"), niveau(1, "◦"), niveau(2, "▪")] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

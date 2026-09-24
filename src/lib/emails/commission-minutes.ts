// ═══════════════════════════════════════════════════════════════
// Email d'envoi du compte rendu de séance (PDF en pièce jointe).
// Même enveloppe que la convocation (logo commune, pied mairie,
// petit logo GoCiviq).
// ═══════════════════════════════════════════════════════════════

import { communeEmailShell, esc, infoRow, panel, paragraph, type EmailCommune } from "./commune-shell";

export interface MinutesEmailParams {
  siteUrl: string;
  commune: EmailCommune;
  commissionName: string;
  recipientName?: string | null;
  /** « Jeudi 1 octobre 2026 à 18h30 » */
  dateLabel: string;
  lieu?: string | null;
  /** Message libre de l'expéditeur (texte brut) */
  message?: string | null;
  senderName?: string | null;
  pdfFilename: string;
}

export function buildMinutesEmail(p: MinutesEmailParams): { subject: string; html: string; text: string } {
  const hello = p.recipientName?.trim() ? `Bonjour ${esc(p.recipientName.trim())},` : "Bonjour,";
  const message = p.message?.trim()
    ? panel(
        p.senderName ? `Message de ${p.senderName}` : "Message",
        esc(p.message.trim()).replace(/\n/g, "<br>"),
      )
    : "";

  const rows = `
    <tr>
      <td style="padding:16px 32px 24px;">
        ${paragraph(hello)}
        ${paragraph(`Veuillez trouver ci-joint le compte rendu validé de la séance de la commission <strong>${esc(p.commissionName)}</strong>.`)}
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 20px;">
          ${infoRow("📅", "Séance du", esc(p.dateLabel))}
          ${p.lieu ? infoRow("📍", "Lieu", esc(p.lieu)) : ""}
          ${infoRow("📎", "Pièce jointe", esc(p.pdfFilename))}
        </table>
        ${message}
      </td>
    </tr>`;

  const html = communeEmailShell({
    siteUrl: p.siteUrl,
    commune: p.commune,
    eyebrow: "Compte rendu de séance",
    title: p.commissionName,
    rows,
    footnote: "Compte rendu envoyé via GoCiviq, plate-forme citoyenne des collectivités.",
  });

  const text = [
    `Compte rendu de séance — ${p.commissionName}`,
    `Mairie de ${p.commune.name}`,
    "",
    p.recipientName?.trim() ? `Bonjour ${p.recipientName.trim()},` : "Bonjour,",
    "",
    `Veuillez trouver ci-joint le compte rendu validé de la séance du ${p.dateLabel}.`,
    p.message?.trim() ? `\n${p.message.trim()}` : null,
    "",
    `Pièce jointe : ${p.pdfFilename}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    subject: `Compte rendu : ${p.commissionName} — séance du ${p.dateLabel}`,
    html,
    text,
  };
}

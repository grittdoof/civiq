// ═══════════════════════════════════════════════════════════════
// Email de convocation à une séance de commission
//
// Charte alignée sur les emails GoCiviq (`commune-decision.ts`,
// `supabase/templates/magic-link.html`) : fond #f5f7fb, carte blanche
// 560px arrondie, eyebrow bleu, titre navy, boutons pill.
//
// Spécificités :
//   • en-tête = LOGO DE LA COMMUNE (repli : nom de la commune) ;
//   • ordre du jour (HTML déjà assaini par sanitizeRichText) ;
//   • réponse de présence : « Je serai présent·e » / « Je ne pourrai
//     pas venir » → page publique /convocation/[token] ;
//   • ajout à l'agenda : Apple (.ics), Google, Outlook ;
//   • pied : adresse et coordonnées de la mairie, puis petit logo
//     GoCiviq.
// ═══════════════════════════════════════════════════════════════

import { EMAIL, communeEmailShell, esc, infoRow, panel, paragraph, type EmailCommune } from "./commune-shell";

const ACCEPT = "#067647";
const DECLINE = "#b42318";

export type ConvocationCommune = EmailCommune;

export interface ConvocationEmailParams {
  siteUrl: string;
  commune: ConvocationCommune;
  commissionName: string;
  recipientName?: string | null;
  /** « Jeudi 1 octobre 2026 à 18h30 » */
  dateLabel: string;
  lieu?: string | null;
  /** HTML assaini (sanitizeRichText) */
  ordreDuJourHtml?: string | null;
  acceptUrl: string;
  declineUrl: string;
  icsUrl: string;
  googleUrl: string | null;
  outlookUrl: string | null;
  isReminder?: boolean;
}

// Boutons en inline-block (et non en cellules de tableau) : ils passent
// à la ligne d'eux-mêmes sur un écran de téléphone.
function pillButton(url: string, label: string, bg: string): string {
  return `<a href="${esc(url)}" style="display:inline-block; margin:4px; background:${bg}; color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; line-height:1; padding:14px 22px; border-radius:999px; white-space:nowrap;">${label}</a>`;
}

function calendarButton(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block; margin:4px; background:#ffffff; color:${EMAIL.TITLE}; text-decoration:none; font-size:13px; font-weight:700; line-height:1; padding:11px 16px; border-radius:999px; border:1px solid ${EMAIL.CARD_BORDER};">${label}</a>`;
}

export function buildConvocationEmail(p: ConvocationEmailParams): { subject: string; html: string; text: string } {
  const { siteUrl, commune } = p;
  const hello = p.recipientName?.trim() ? `Bonjour ${esc(p.recipientName.trim())},` : "Bonjour,";
  const intro = p.isReminder
    ? `Pour rappel, vous êtes convoqué·e à la séance de la commission <strong>${esc(p.commissionName)}</strong>.`
    : `Vous êtes convoqué·e à la prochaine séance de la commission <strong>${esc(p.commissionName)}</strong>.`;

  const odj = p.ordreDuJourHtml?.trim() ? panel("Ordre du jour", p.ordreDuJourHtml) : "";

  const calendarButtons = [
    calendarButton(p.icsUrl, "Apple"),
    p.googleUrl ? calendarButton(p.googleUrl, "Google") : "",
    p.outlookUrl ? calendarButton(p.outlookUrl, "Outlook") : "",
  ].join("");

  const title = p.isReminder ? "Rappel de convocation" : "Convocation";

  const rows = `
    <tr>
      <td style="padding:16px 32px 8px;">
        ${paragraph(hello)}
        ${paragraph(intro)}
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 20px;">
          ${infoRow("📅", "Date", esc(p.dateLabel))}
          ${p.lieu ? infoRow("📍", "Lieu", esc(p.lieu)) : ""}
        </table>
        ${odj}
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 8px; text-align:center;">
        <p style="margin:0 0 10px; color:${EMAIL.TITLE}; font-size:16px; font-weight:800;">Merci de confirmer votre présence</p>
        <div style="margin:0 0 22px; text-align:center;">
          ${pillButton(p.acceptUrl, "✓ Je serai présent·e", ACCEPT)}
          ${pillButton(p.declineUrl, "✕ Je ne pourrai pas venir", DECLINE)}
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px; text-align:center;">
        <p style="margin:0 0 8px; color:${EMAIL.MUTED}; font-size:13px; font-weight:700;">Ajouter à mon agenda</p>
        <div style="text-align:center;">${calendarButtons}</div>
      </td>
    </tr>`;

  const html = communeEmailShell({
    siteUrl,
    commune,
    eyebrow: title,
    title: p.commissionName,
    rows,
    footnote: "Convocation envoyée via GoCiviq, plate-forme citoyenne des collectivités.",
  });

  const text = [
    `${title} — ${p.commissionName}`,
    `Mairie de ${commune.name}`,
    "",
    p.recipientName?.trim() ? `Bonjour ${p.recipientName.trim()},` : "Bonjour,",
    "",
    `Date : ${p.dateLabel}`,
    p.lieu ? `Lieu : ${p.lieu}` : null,
    "",
    `Je serai présent·e : ${p.acceptUrl}`,
    `Je ne pourrai pas venir : ${p.declineUrl}`,
    "",
    `Ajouter à mon agenda (.ics) : ${p.icsUrl}`,
    p.googleUrl ? `Google Agenda : ${p.googleUrl}` : null,
    p.outlookUrl ? `Outlook : ${p.outlookUrl}` : null,
    "",
    [commune.address, commune.phone, commune.contact_email].filter(Boolean).join(" · ") || null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    subject: `${p.isReminder ? "Rappel — " : ""}Convocation : ${p.commissionName} — ${p.dateLabel}`,
    html,
    text,
  };
}

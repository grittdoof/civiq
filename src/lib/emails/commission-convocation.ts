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

const BODY_BG = "#f5f7fb";
const CARD_BORDER = "#e6eaf2";
const EYEBROW = "#2f6fdb";
const TITLE = "#042f64";
const BODY_TEXT = "#3f4964";
const MUTED = "#667085";
const FOOTER_BG = "#f9fafc";
const BOTTOM = "#8a94a6";
const ACCEPT = "#067647";
const DECLINE = "#b42318";

export interface ConvocationCommune {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  code_postal?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
}

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

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(url: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Boutons en inline-block (et non en cellules de tableau) : ils passent
// à la ligne d'eux-mêmes sur un écran de téléphone.
function pillButton(url: string, label: string, bg: string): string {
  return `<a href="${esc(url)}" style="display:inline-block; margin:4px; background:${bg}; color:#ffffff; text-decoration:none; font-size:15px; font-weight:700; line-height:1; padding:14px 22px; border-radius:999px; white-space:nowrap;">${label}</a>`;
}

function calendarButton(url: string, label: string): string {
  return `<a href="${esc(url)}" style="display:inline-block; margin:4px; background:#ffffff; color:${TITLE}; text-decoration:none; font-size:13px; font-weight:700; line-height:1; padding:11px 16px; border-radius:999px; border:1px solid ${CARD_BORDER};">${label}</a>`;
}

function infoRow(icon: string, label: string, valueHtml: string): string {
  return `<tr>
    <td style="padding:6px 10px 6px 0; font-size:18px; width:28px; vertical-align:top;">${icon}</td>
    <td style="padding:6px 0; vertical-align:top;">
      <div style="font-size:12px; color:${MUTED}; text-transform:uppercase; letter-spacing:.06em; font-weight:700;">${label}</div>
      <div style="font-size:16px; color:${TITLE}; font-weight:700; line-height:1.4;">${valueHtml}</div>
    </td>
  </tr>`;
}

function communeFooter(commune: ConvocationCommune): string {
  const lines: string[] = [];
  if (commune.address) lines.push(esc(commune.address));
  if (commune.code_postal && !(commune.address ?? "").includes(commune.code_postal)) {
    lines.push(`${esc(commune.code_postal)} ${esc(commune.name)}`);
  }
  const contacts: string[] = [];
  if (commune.phone) contacts.push(`Tél. ${esc(commune.phone)}`);
  if (commune.contact_email) {
    contacts.push(
      `<a href="mailto:${esc(commune.contact_email)}" style="color:${EYEBROW}; text-decoration:none;">${esc(commune.contact_email)}</a>`,
    );
  }
  if (commune.website_url) {
    contacts.push(
      `<a href="${esc(commune.website_url)}" style="color:${EYEBROW}; text-decoration:none;">${esc(commune.website_url.replace(/^https?:\/\//, ""))}</a>`,
    );
  }
  return `
    <p style="margin:0 0 4px; color:${TITLE}; font-size:14px; font-weight:800;">Mairie de ${esc(commune.name)}</p>
    ${lines.length ? `<p style="margin:0 0 4px; color:${BODY_TEXT}; font-size:13px; line-height:1.5;">${lines.join("<br>")}</p>` : ""}
    ${contacts.length ? `<p style="margin:0; color:${BODY_TEXT}; font-size:13px; line-height:1.6;">${contacts.join(" · ")}</p>` : ""}`;
}

export function buildConvocationEmail(p: ConvocationEmailParams): { subject: string; html: string; text: string } {
  const { siteUrl, commune } = p;
  const gociviqLogo = `${siteUrl}/brand/logo-horizontal.png`;
  const header = commune.logo_url
    ? `<img src="${esc(absoluteUrl(commune.logo_url, siteUrl))}" alt="${esc(commune.name)}" height="72" style="display:block; height:72px; width:auto; max-width:240px; margin:0 auto 20px; border:0;">`
    : `<p style="margin:0 0 20px; color:${TITLE}; font-size:18px; font-weight:800;">🏛️ ${esc(commune.name)}</p>`;

  const hello = p.recipientName?.trim() ? `Bonjour ${esc(p.recipientName.trim())},` : "Bonjour,";
  const intro = p.isReminder
    ? `Pour rappel, vous êtes convoqué·e à la séance de la commission <strong>${esc(p.commissionName)}</strong>.`
    : `Vous êtes convoqué·e à la prochaine séance de la commission <strong>${esc(p.commissionName)}</strong>.`;

  const odj = p.ordreDuJourHtml?.trim()
    ? `<div style="margin:6px 0 24px;">
        <p style="margin:0 0 8px; color:${EYEBROW}; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">Ordre du jour</p>
        <div style="padding:14px 18px; background:${FOOTER_BG}; border:1px solid ${CARD_BORDER}; border-radius:12px; color:${BODY_TEXT}; font-size:15px; line-height:1.6;">${p.ordreDuJourHtml}</div>
      </div>`
    : "";

  const calendarButtons = [
    calendarButton(p.icsUrl, "Apple"),
    p.googleUrl ? calendarButton(p.googleUrl, "Google") : "",
    p.outlookUrl ? calendarButton(p.outlookUrl, "Outlook") : "",
  ].join("");

  const title = p.isReminder ? "Rappel de convocation" : "Convocation";

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)} — ${esc(p.commissionName)}</title>
  </head>
  <body style="margin:0; padding:0; background:${BODY_BG}; font-family:Arial, Helvetica, sans-serif; color:#1a2744;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BODY_BG}; margin:0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; background:#ffffff; border:1px solid ${CARD_BORDER}; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 12px; text-align:center;">
                ${header}
                <p style="margin:0; color:${EYEBROW}; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${esc(title)}</p>
                <h1 style="margin:10px 0 0; color:${TITLE}; font-size:26px; line-height:1.25; font-weight:800;">${esc(p.commissionName)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <p style="margin:0 0 14px; color:${BODY_TEXT}; font-size:16px; line-height:1.6;">${hello}</p>
                <p style="margin:0 0 18px; color:${BODY_TEXT}; font-size:16px; line-height:1.6;">${intro}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="margin:0 0 20px;">
                  ${infoRow("📅", "Date", esc(p.dateLabel))}
                  ${p.lieu ? infoRow("📍", "Lieu", esc(p.lieu)) : ""}
                </table>
                ${odj}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px; text-align:center;">
                <p style="margin:0 0 10px; color:${TITLE}; font-size:16px; font-weight:800;">Merci de confirmer votre présence</p>
                <div style="margin:0 0 22px; text-align:center;">
                  ${pillButton(p.acceptUrl, "✓ Je serai présent·e", ACCEPT)}
                  ${pillButton(p.declineUrl, "✕ Je ne pourrai pas venir", DECLINE)}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px; text-align:center;">
                <p style="margin:0 0 8px; color:${MUTED}; font-size:13px; font-weight:700;">Ajouter à mon agenda</p>
                <div style="text-align:center;">${calendarButtons}</div>
              </td>
            </tr>
            <tr>
              <td style="background:${FOOTER_BG}; border-top:1px solid ${CARD_BORDER}; padding:22px 32px;">
                ${communeFooter(commune)}
              </td>
            </tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="max-width:560px; margin:18px auto 0;">
            <tr>
              <td align="center">
                <img src="${gociviqLogo}" width="96" alt="GoCiviq" style="display:block; width:96px; height:auto; margin:0 auto 6px; border:0; opacity:.85;">
                <p style="margin:0; color:${BOTTOM}; font-size:11px; line-height:1.5; text-align:center;">
                  Convocation envoyée via GoCiviq, plate-forme citoyenne des collectivités.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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

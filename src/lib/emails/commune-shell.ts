// ═══════════════════════════════════════════════════════════════
// Enveloppe des emails envoyés AU NOM D'UNE COMMUNE (convocations,
// comptes rendus…).
//
// Charte GoCiviq (cf. `commune-decision.ts` / magic-link.html) :
// fond #f5f7fb, carte blanche 560px arrondie, eyebrow bleu, titre
// navy. En-tête = logo de la commune (repli : nom) ; pied = adresse
// et coordonnées de la mairie, puis petit logo GoCiviq (PNG : Gmail
// n'affiche pas le SVG).
// ═══════════════════════════════════════════════════════════════

export const EMAIL = {
  BODY_BG: "#f5f7fb",
  CARD_BORDER: "#e6eaf2",
  EYEBROW: "#2f6fdb",
  TITLE: "#042f64",
  BODY_TEXT: "#3f4964",
  MUTED: "#667085",
  FOOTER_BG: "#f9fafc",
  BOTTOM: "#8a94a6",
} as const;

export interface EmailCommune {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  code_postal?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
}

export function esc(s: string): string {
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

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px; color:${EMAIL.BODY_TEXT}; font-size:16px; line-height:1.6;">${html}</p>`;
}

export function infoRow(icon: string, label: string, valueHtml: string): string {
  return `<tr>
    <td style="padding:6px 10px 6px 0; font-size:18px; width:28px; vertical-align:top;">${icon}</td>
    <td style="padding:6px 0; vertical-align:top;">
      <div style="font-size:12px; color:${EMAIL.MUTED}; text-transform:uppercase; letter-spacing:.06em; font-weight:700;">${label}</div>
      <div style="font-size:16px; color:${EMAIL.TITLE}; font-weight:700; line-height:1.4;">${valueHtml}</div>
    </td>
  </tr>`;
}

/** Encadré titré (ordre du jour, message…) — `innerHtml` déjà sûr. */
export function panel(label: string, innerHtml: string): string {
  return `<div style="margin:6px 0 24px;">
    <p style="margin:0 0 8px; color:${EMAIL.EYEBROW}; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${esc(label)}</p>
    <div style="padding:14px 18px; background:${EMAIL.FOOTER_BG}; border:1px solid ${EMAIL.CARD_BORDER}; border-radius:12px; color:${EMAIL.BODY_TEXT}; font-size:15px; line-height:1.6;">${innerHtml}</div>
  </div>`;
}

function communeFooter(commune: EmailCommune): string {
  const lines: string[] = [];
  if (commune.address) lines.push(esc(commune.address));
  if (commune.code_postal && !(commune.address ?? "").includes(commune.code_postal)) {
    lines.push(`${esc(commune.code_postal)} ${esc(commune.name)}`);
  }
  const contacts: string[] = [];
  if (commune.phone) contacts.push(`Tél. ${esc(commune.phone)}`);
  if (commune.contact_email) {
    contacts.push(
      `<a href="mailto:${esc(commune.contact_email)}" style="color:${EMAIL.EYEBROW}; text-decoration:none;">${esc(commune.contact_email)}</a>`,
    );
  }
  if (commune.website_url) {
    contacts.push(
      `<a href="${esc(commune.website_url)}" style="color:${EMAIL.EYEBROW}; text-decoration:none;">${esc(commune.website_url.replace(/^https?:\/\//, ""))}</a>`,
    );
  }
  return `
    <p style="margin:0 0 4px; color:${EMAIL.TITLE}; font-size:14px; font-weight:800;">Mairie de ${esc(commune.name)}</p>
    ${lines.length ? `<p style="margin:0 0 4px; color:${EMAIL.BODY_TEXT}; font-size:13px; line-height:1.5;">${lines.join("<br>")}</p>` : ""}
    ${contacts.length ? `<p style="margin:0; color:${EMAIL.BODY_TEXT}; font-size:13px; line-height:1.6;">${contacts.join(" · ")}</p>` : ""}`;
}

/**
 * Document HTML complet. `rows` = lignes <tr> du corps de la carte
 * (chacune avec son <td> et son padding).
 */
export function communeEmailShell(p: {
  siteUrl: string;
  commune: EmailCommune;
  eyebrow: string;
  title: string;
  rows: string;
  /** Mention sous le logo GoCiviq */
  footnote: string;
}): string {
  const { siteUrl, commune } = p;
  const header = commune.logo_url
    ? `<img src="${esc(absoluteUrl(commune.logo_url, siteUrl))}" alt="${esc(commune.name)}" height="72" style="display:block; height:72px; width:auto; max-width:240px; margin:0 auto 20px; border:0;">`
    : `<p style="margin:0 0 20px; color:${EMAIL.TITLE}; font-size:18px; font-weight:800;">🏛️ ${esc(commune.name)}</p>`;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(p.eyebrow)} — ${esc(p.title)}</title>
  </head>
  <body style="margin:0; padding:0; background:${EMAIL.BODY_BG}; font-family:Arial, Helvetica, sans-serif; color:#1a2744;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL.BODY_BG}; margin:0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; background:#ffffff; border:1px solid ${EMAIL.CARD_BORDER}; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 12px; text-align:center;">
                ${header}
                <p style="margin:0; color:${EMAIL.EYEBROW}; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${esc(p.eyebrow)}</p>
                <h1 style="margin:10px 0 0; color:${EMAIL.TITLE}; font-size:26px; line-height:1.25; font-weight:800;">${esc(p.title)}</h1>
              </td>
            </tr>
            ${p.rows}
            <tr>
              <td style="background:${EMAIL.FOOTER_BG}; border-top:1px solid ${EMAIL.CARD_BORDER}; padding:22px 32px;">
                ${communeFooter(commune)}
              </td>
            </tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="max-width:560px; margin:18px auto 0;">
            <tr>
              <td align="center">
                <img src="${siteUrl}/brand/logo-horizontal.png" width="96" alt="GoCiviq" style="display:block; width:96px; height:auto; margin:0 auto 6px; border:0; opacity:.85;">
                <p style="margin:0; color:${EMAIL.BOTTOM}; font-size:11px; line-height:1.5; text-align:center;">${esc(p.footnote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

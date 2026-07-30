// ═══════════════════════════════════════════════════════════════
// Emails de décision d'une demande de rattachement (approbation / refus)
//
// Reprend À L'IDENTIQUE la charte du template d'auth Supabase
// (`supabase/templates/magic-link.html`) pour une cohérence totale des
// emails GoCiviq : fond #f5f7fb, carte blanche arrondie 560px, logo
// horizontal centré, eyebrow bleu majuscule, titre navy, bouton pill,
// bandeau footer, puis ligne « Plate-forme citoyenne… ».
//
// Le bloc « coordonnées de la mairie » n'apparaît que si une commune
// est rattachée (join, ou create une fois la commune provisionnée).
// ═══════════════════════════════════════════════════════════════

// Tokens repris du template magic-link.html
const BODY_BG = "#f5f7fb";
const CARD_BORDER = "#e6eaf2";
const EYEBROW = "#2f6fdb";
const TITLE = "#042f64";
const BODY_TEXT = "#3f4964";
const MUTED = "#667085";
const FOOTER_BG = "#f9fafc";
const BOTTOM = "#8a94a6";
const BUTTON = "#042f64"; // pill navy (cf. capture du lien magique)

export interface CommuneContact {
  name: string;
  code_postal?: string | null;
  contact_email?: string | null;
  website_url?: string | null;
  phone?: string | null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleLabel(role: string): string {
  if (role === "admin") return "Administrateur de l'espace commune";
  if (role === "editor") return "Éditeur";
  return role;
}

// Enveloppe identique au template magic-link : carte blanche centrée,
// logo horizontal, eyebrow + titre, contenu, bandeau footer, baseline.
function shell(params: {
  siteUrl: string;
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerLead: string;
  footerNote: string;
}): string {
  const { siteUrl, eyebrow, title, bodyHtml, footerLead, footerNote } = params;
  const logo = `${siteUrl}/brand/logo-horizontal.svg`;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
  </head>
  <body style="margin:0; padding:0; background:${BODY_BG}; font-family:Arial, Helvetica, sans-serif; color:#1a2744;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BODY_BG}; margin:0; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px; background:#ffffff; border:1px solid ${CARD_BORDER}; border-radius:18px; overflow:hidden;">
            <tr>
              <td style="padding:34px 34px 18px; text-align:center;">
                <img src="${logo}" width="184" alt="GoCiviq" style="display:block; width:184px; max-width:100%; height:auto; margin:0 auto 24px;">
                <p style="margin:0; color:${EYEBROW}; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;">${esc(eyebrow)}</p>
                <h1 style="margin:10px 0 0; color:${TITLE}; font-size:28px; line-height:1.2; font-weight:800;">${esc(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 34px 28px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td style="background:${FOOTER_BG}; border-top:1px solid ${CARD_BORDER}; padding:22px 34px;">
                <p style="margin:0 0 6px; color:${BODY_TEXT}; font-size:13px; line-height:1.5;">${esc(footerLead)}</p>
                <p style="margin:0; color:${MUTED}; font-size:12px; line-height:1.5;">${esc(footerNote)}</p>
              </td>
            </tr>
          </table>
          <p style="max-width:560px; margin:18px auto 0; color:${BOTTOM}; font-size:12px; line-height:1.5; text-align:center;">
            GoCiviq - Plate-forme citoyenne pour les collectivites.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px; color:${BODY_TEXT}; font-size:16px; line-height:1.6;">${html}</p>`;
}

function button(url: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;">
      <tr><td align="center" style="border-radius:999px; background:${BUTTON};">
        <a href="${url}" style="display:inline-block; background:${BUTTON}; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; line-height:1; padding:16px 28px; border-radius:999px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

function communeBlock(commune: CommuneContact): string {
  const line = (label: string, value: string) =>
    `<tr><td style="padding:3px 0; font-size:14px; color:${MUTED}; width:120px;">${label}</td><td style="padding:3px 0; font-size:14px; color:${TITLE}; font-weight:700;">${value}</td></tr>`;
  const rows: string[] = [];
  if (commune.code_postal) rows.push(line("Code postal", esc(commune.code_postal)));
  if (commune.contact_email)
    rows.push(line("Email", `<a href="mailto:${esc(commune.contact_email)}" style="color:${EYEBROW}; text-decoration:none;">${esc(commune.contact_email)}</a>`));
  if (commune.phone) rows.push(line("Téléphone", esc(commune.phone)));
  if (commune.website_url)
    rows.push(line("Site web", `<a href="${esc(commune.website_url)}" style="color:${EYEBROW}; text-decoration:none;">${esc(commune.website_url)}</a>`));

  return `
    <div style="margin:4px 0 20px; padding:16px 18px; background:${FOOTER_BG}; border:1px solid ${CARD_BORDER}; border-radius:12px;">
      <p style="margin:0 0 10px; color:${TITLE}; font-size:14px; font-weight:800;">🏛️ ${esc(commune.name)}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
        ${rows.join("") || `<tr><td style="font-size:14px; color:${MUTED};">Coordonnées à compléter depuis votre espace.</td></tr>`}
      </table>
    </div>`;
}

// ─── Email d'approbation ───
export function buildApprovalEmail(params: {
  siteUrl: string;
  userName?: string | null;
  role: string;
  commune: CommuneContact | null;
}): { subject: string; html: string } {
  const { siteUrl, userName, role, commune } = params;
  const hello = userName?.trim() ? `Bonjour ${esc(userName.trim())},` : "Bonjour,";
  const communeName = commune ? esc(commune.name) : "votre commune";

  const bodyHtml = [
    paragraph(hello),
    paragraph(
      `Bonne nouvelle : un super-administrateur a validé votre rattachement à <strong>${communeName}</strong>. Votre compte est désormais actif avec le rôle <strong>${esc(roleLabel(role))}</strong>.`,
    ),
    commune ? communeBlock(commune) : "",
    paragraph("Connectez-vous pour accéder à votre espace et aux modules activés pour votre commune."),
    button(`${siteUrl}/auth/login`, "Accéder à mon espace"),
  ].join("");

  return {
    subject: `Votre accès à ${commune ? commune.name : "GoCiviq"} est validé`,
    html: shell({
      siteUrl,
      eyebrow: "Demande validée",
      title: "Votre accès est activé",
      bodyHtml,
      footerLead: "Une question sur votre espace ?",
      footerNote: "Répondez simplement à cet email, notre équipe vous accompagne.",
    }),
  };
}

// ─── Email de refus ───
export function buildRejectionEmail(params: {
  siteUrl: string;
  userName?: string | null;
  reason?: string | null;
  communeName?: string | null;
  commune?: CommuneContact | null;
}): { subject: string; html: string } {
  const { siteUrl, userName, reason, communeName, commune } = params;
  const hello = userName?.trim() ? `Bonjour ${esc(userName.trim())},` : "Bonjour,";
  const cibleName = commune?.name ?? communeName ?? null;
  const cible = cibleName ? ` à ${esc(cibleName)}` : "";

  const reasonBlock = reason?.trim()
    ? `<div style="margin:4px 0 20px; padding:14px 16px; background:${FOOTER_BG}; border-left:3px solid ${EYEBROW}; border-radius:10px; color:${BODY_TEXT}; font-size:14px; line-height:1.55;"><strong style="color:${TITLE};">Motif :</strong> ${esc(reason.trim())}</div>`
    : "";

  const bodyHtml = [
    paragraph(hello),
    paragraph(`Après examen, votre demande de rattachement${cible} n'a pas pu être validée pour le moment.`),
    reasonBlock,
    commune ? communeBlock(commune) : "",
    paragraph("Vous pouvez soumettre une nouvelle demande depuis votre espace, en précisant votre rôle au sein de la commune pour faciliter la validation."),
    button(`${siteUrl}/admin/onboarding`, "Soumettre une nouvelle demande"),
  ].join("");

  return {
    subject: "Suite à votre demande d'inscription GoCiviq",
    html: shell({
      siteUrl,
      eyebrow: "Décision de votre demande",
      title: "Votre demande n'a pas été retenue",
      bodyHtml,
      footerLead: "Vous pensez qu'il s'agit d'une erreur ?",
      footerNote: "Soumettez une nouvelle demande ou répondez à cet email pour nous contacter.",
    }),
  };
}

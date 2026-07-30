// ═══════════════════════════════════════════════════════════════
// Emails de décision d'une demande de rattachement (approbation / refus)
//
// HTML « email-safe » : tables + styles inline, pas de SVG (bloqué par
// Gmail) → logo en PNG via URL absolue. Charte GoCiviq :
//   marine #1a2744 (fond header)  ·  or #c9a84c (accents / bouton)
//
// Le bloc « coordonnées de la mairie » n'apparaît que si une commune
// est rattachée (cas join, ou create une fois la commune provisionnée).
// ═══════════════════════════════════════════════════════════════

const MARINE = "#1a2744";
const OR = "#c9a84c";
const FG = "#1a2744";
const MUTED = "#5b6472";
const BORDER = "#e6e3da";
const BG = "#f6f5f1";

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

// Enveloppe commune : header marine + logo, carte blanche, footer.
function shell(siteUrl: string, bodyHtml: string): string {
  const logo = `${siteUrl}/app-icon/icon-192.png`;
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${FG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,39,68,0.08);">
        <tr>
          <td style="background:${MARINE};padding:22px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="${logo}" width="36" height="36" alt="GoCiviq" style="display:block;border-radius:8px;">
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-0.02em;">GoCiviq</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:4px;background:${OR};"></td></tr>
        <tr><td style="padding:28px;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:18px 28px;border-top:1px solid ${BORDER};background:#fbfaf7;">
            <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.5;">
              GoCiviq — la plateforme de participation citoyenne des communes.<br>
              Cet email vous est envoyé suite à votre demande d'inscription.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function communeBlock(commune: CommuneContact): string {
  const rows: string[] = [];
  const line = (label: string, value: string) =>
    `<tr><td style="padding:2px 0;font-size:13px;color:${MUTED};width:110px;">${label}</td><td style="padding:2px 0;font-size:13px;color:${FG};font-weight:600;">${value}</td></tr>`;

  if (commune.code_postal) rows.push(line("Code postal", esc(commune.code_postal)));
  if (commune.contact_email)
    rows.push(line("Email", `<a href="mailto:${esc(commune.contact_email)}" style="color:${MARINE};">${esc(commune.contact_email)}</a>`));
  if (commune.phone) rows.push(line("Téléphone", esc(commune.phone)));
  if (commune.website_url)
    rows.push(line("Site web", `<a href="${esc(commune.website_url)}" style="color:${MARINE};">${esc(commune.website_url)}</a>`));

  return `
    <div style="margin:20px 0;padding:16px;background:${BG};border:1px solid ${BORDER};border-radius:12px;">
      <div style="font-size:13px;font-weight:700;color:${FG};margin-bottom:10px;">
        🏛️ ${esc(commune.name)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${rows.join("") || `<tr><td style="font-size:13px;color:${MUTED};">Coordonnées à compléter depuis votre espace.</td></tr>`}
      </table>
    </div>`;
}

function button(url: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;">
      <tr><td style="border-radius:10px;background:${MARINE};">
        <a href="${url}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
      </td></tr>
    </table>`;
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

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${FG};">Votre demande est validée ✅</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${FG};">${hello}</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${FG};">
      Bonne nouvelle : un super-administrateur a validé votre rattachement à
      <strong>${communeName}</strong>. Votre compte est désormais actif avec le rôle
      <strong>${esc(roleLabel(role))}</strong>.
    </p>
    ${commune ? communeBlock(commune) : ""}
    <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${FG};">
      Connectez-vous pour accéder à votre espace et aux modules activés pour votre commune.
    </p>
    ${button(`${siteUrl}/auth/login`, "Accéder à mon espace")}
  `;

  return {
    subject: `Votre accès à ${commune ? commune.name : "GoCiviq"} est validé`,
    html: shell(siteUrl, body),
  };
}

// ─── Email de refus ───
export function buildRejectionEmail(params: {
  siteUrl: string;
  userName?: string | null;
  reason?: string | null;
  communeName?: string | null;
}): { subject: string; html: string } {
  const { siteUrl, userName, reason, communeName } = params;
  const hello = userName?.trim() ? `Bonjour ${esc(userName.trim())},` : "Bonjour,";
  const cible = communeName ? ` à ${esc(communeName)}` : "";

  const reasonBlock = reason?.trim()
    ? `<div style="margin:18px 0;padding:14px 16px;background:${BG};border-left:3px solid ${OR};border-radius:8px;font-size:13px;color:${FG};line-height:1.5;"><strong>Motif :</strong> ${esc(reason.trim())}</div>`
    : "";

  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${FG};">Votre demande n'a pas été retenue</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${FG};">${hello}</p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${FG};">
      Après examen, votre demande de rattachement${cible} n'a pas pu être validée pour le moment.
    </p>
    ${reasonBlock}
    <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:${FG};">
      Vous pouvez soumettre une nouvelle demande depuis votre espace, en précisant votre rôle
      au sein de la commune pour faciliter la validation.
    </p>
    ${button(`${siteUrl}/admin/onboarding`, "Soumettre une nouvelle demande")}
  `;

  return {
    subject: "Suite à votre demande d'inscription GoCiviq",
    html: shell(siteUrl, body),
  };
}

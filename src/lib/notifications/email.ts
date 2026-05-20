/**
 * Envoi d'emails transactionnels via Resend.
 *
 * No-op si RESEND_API_KEY n'est pas configurée → le projet continue
 * à tourner sans email. À activer en prod via Vercel env vars :
 *   RESEND_API_KEY   = re_xxxx
 *   EMAIL_FROM       = "GoCiviq <notifications@gociviq.fr>"
 *
 * Free tier Resend : 100 emails/jour, 3 000/mois.
 */

import { createServiceClient } from "@/lib/supabase-server";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendResult {
  sent: number;
  failed: number;
}

let warned = false;

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "GoCiviq <notifications@gociviq.fr>";

  if (!apiKey) {
    if (!warned) {
      console.warn("[email] RESEND_API_KEY absente — emails désactivés");
      warned = true;
    }
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[email] Resend error", res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send error", err);
    return false;
  }
}

/**
 * Récupère les emails des profils ciblés via auth.users.
 * Retourne uniquement les emails confirmés et présents.
 */
export async function getEmailsForProfiles(profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const service = await createServiceClient();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (!users?.users) return [];
  return users.users
    .filter((u) => profileIds.includes(u.id) && u.email && u.email_confirmed_at)
    .map((u) => u.email as string);
}

/**
 * Notification email à plusieurs agents pour la réouverture d'un ticket.
 */
export async function sendTicketReopenedEmail(opts: {
  profileIds: string[];
  ticketNumero: number;
  titre: string;
  ticketUrl: string;
  reason?: string | null;
}): Promise<SendResult> {
  const emails = await getEmailsForProfiles(opts.profileIds);
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const reasonBlock = opts.reason
    ? `<p style="margin:0 0 12px;color:#555;"><strong>Raison :</strong> ${escapeHtml(opts.reason)}</p>`
    : "";

  const html = `
<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a2744;">
  <div style="background:#1a2744;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:18px;">🔄 Ticket #${opts.ticketNumero} rouvert</h1>
  </div>
  <div style="background:#fff;padding:20px;border:1px solid #e8e5de;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;">Bonjour,</p>
    <p style="margin:0 0 12px;">Le ticket suivant a été automatiquement rouvert selon la date de suivi programmée :</p>
    <p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(opts.titre)}</strong></p>
    ${reasonBlock}
    <p style="margin:18px 0 0;">
      <a href="${opts.ticketUrl}" style="display:inline-block;padding:10px 18px;background:#3b6fa0;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
        Ouvrir le ticket
      </a>
    </p>
    <p style="margin:18px 0 0;font-size:12px;color:#888;">
      Vous recevez cet email car vous étiez assigné·e à ce ticket.
    </p>
  </div>
</div>`.trim();

  const text = `Ticket #${opts.ticketNumero} rouvert : ${opts.titre}\n${opts.reason ? "Raison : " + opts.reason + "\n" : ""}\nVoir : ${opts.ticketUrl}`;

  const ok = await sendEmail({
    to: emails,
    subject: `🔄 Ticket #${opts.ticketNumero} rouvert — ${opts.titre.slice(0, 60)}`,
    html,
    text,
  });

  return { sent: ok ? emails.length : 0, failed: ok ? 0 : emails.length };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

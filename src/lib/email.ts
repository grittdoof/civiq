// ═══════════════════════════════════════════════════════════════
// Envoi d'emails transactionnels — API Resend (REST, sans SDK)
//
// Aucune dépendance npm : on appelle directement l'API HTTP de Resend
// afin de rester provider-agnostique et sans churn de lockfile.
//
// GRACIEUX PAR DESIGN : si `RESEND_API_KEY` ou `EMAIL_FROM` ne sont
// pas configurés, `sendEmail()` log un avertissement et renvoie
// `{ sent: false }` SANS jamais throw. Aucune action métier (validation
// d'une demande, etc.) ne doit être bloquée par un échec d'email.
//
// Configuration (Vercel → Environment Variables) :
//   RESEND_API_KEY = re_xxx                         (clé API Resend)
//   EMAIL_FROM     = "GoCiviq <no-reply@votredomaine.fr>"
//   NEXT_PUBLIC_SITE_URL = https://votre-app.vercel.app  (liens + logo)
//
// Le domaine de EMAIL_FROM doit être vérifié dans Resend, sinon les
// envois échouent (ou ne partent qu'à l'adresse du compte en test).
// ═══════════════════════════════════════════════════════════════

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Pièces jointes (40 Mo max au total côté Resend) */
  attachments?: EmailAttachment[];
}

interface SendEmailResult {
  sent: boolean;
  error?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn(
      "[email] RESEND_API_KEY ou EMAIL_FROM absent — email non envoyé (dégradation gracieuse).",
    );
    return { sent: false, error: "email_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content.toString("base64"),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] Resend a répondu", res.status, detail);
      return { sent: false, error: `resend_${res.status}` };
    }

    return { sent: true };
  } catch (e) {
    console.error("[email] échec de l'envoi:", e);
    return { sent: false, error: "network" };
  }
}

export interface BatchEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface BatchEmailResult {
  /** Un booléen par email, dans l'ordre d'entrée */
  sent: boolean[];
  error?: string;
}

// Envoi groupé (API batch Resend, 100 emails max par appel) : un seul
// appel HTTP pour N destinataires aux contenus personnalisés — évite la
// limite de débit (2 req/s) et garde la requête courte côté Vercel.
// Même contrat gracieux que sendEmail : ne throw jamais.
export async function sendEmailBatch(emails: BatchEmail[]): Promise<BatchEmailResult> {
  if (emails.length === 0) return { sent: [] };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY ou EMAIL_FROM absent — emails non envoyés.");
    return { sent: emails.map(() => false), error: "email_not_configured" };
  }

  const sent: boolean[] = [];
  let lastError: string | undefined;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunk.map((e) => ({
            from,
            to: [e.to],
            subject: e.subject,
            html: e.html,
            ...(e.text ? { text: e.text } : {}),
            ...(e.replyTo ? { reply_to: e.replyTo } : {}),
          })),
        ),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[email] Resend batch a répondu", res.status, detail);
        lastError = `resend_${res.status}`;
        sent.push(...chunk.map(() => false));
      } else {
        sent.push(...chunk.map(() => true));
      }
    } catch (e) {
      console.error("[email] échec de l'envoi groupé:", e);
      lastError = "network";
      sent.push(...chunk.map(() => false));
    }
  }
  return { sent, ...(lastError ? { error: lastError } : {}) };
}

// URL absolue du site (liens et images des emails). Fallback en cascade :
// variable explicite → URL Vercel de déploiement → domaine de prod.
export function getSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://gociviq.fr";
}

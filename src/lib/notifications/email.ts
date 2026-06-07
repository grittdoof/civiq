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

export type NotifCategory =
  | "assignment"
  | "urgent_unassigned"
  | "comment"
  | "closure"
  | "reopen";

/**
 * Filtre une liste de profileIds par la préférence notification_preferences
 * pour la catégorie demandée. Si une ligne n'existe pas, on considère que
 * la préférence est ACTIVÉE par défaut (cf. defaults SQL `notify_* = true`).
 * Renvoie le sous-ensemble des profileIds qui ont opt-in.
 */
export async function filterProfilesByPreference(
  profileIds: string[],
  category: NotifCategory,
): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const service = await createServiceClient();
  const { data: prefs } = await service
    .from("notification_preferences")
    .select(
      "profile_id, notify_assignment, notify_urgent_unassigned, notify_comment, notify_closure",
    )
    .in("profile_id", profileIds);

  const map = new Map<string, Record<string, boolean>>();
  for (const p of prefs ?? []) map.set(p.profile_id, p);

  const accept = (p: Record<string, boolean> | undefined): boolean => {
    if (!p) return true; // pas de ligne → defaults DB true → on accepte
    switch (category) {
      case "assignment": return p.notify_assignment;
      case "urgent_unassigned": return p.notify_urgent_unassigned;
      case "comment": return p.notify_comment;
      case "closure": return p.notify_closure;
      // Réouverture = de la famille "assignment" du point de vue de
      // l'agent (il reprend la main sur son ticket).
      case "reopen": return p.notify_assignment;
    }
  };

  return profileIds.filter((id) => accept(map.get(id)));
}

/**
 * Récupère les emails des profils ciblés via auth.users, EN RESPECTANT
 * la préférence de notification pour la catégorie. Si l'utilisateur a
 * désactivé cette catégorie dans son profil, il n'est pas inclus dans
 * la liste retournée → pas d'email envoyé.
 */
export async function getEmailsForProfiles(
  profileIds: string[],
  category?: NotifCategory,
): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const filtered = category
    ? await filterProfilesByPreference(profileIds, category)
    : profileIds;
  if (filtered.length === 0) return [];
  const service = await createServiceClient();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (!users?.users) return [];
  return users.users
    .filter((u) => filtered.includes(u.id) && u.email && u.email_confirmed_at)
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
  const emails = await getEmailsForProfiles(opts.profileIds, "reopen");
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

/**
 * Notification email à un ou plusieurs agents lors d'une assignation
 * de ticket. Inclut : titre, priorité, catégorie, adresse, description
 * et un bouton CTA vers le détail.
 */
export async function sendTicketAssignedEmail(opts: {
  profileIds: string[];
  ticketId: string;
  ticketNumero: number;
  titre: string;
  ticketUrl: string;
  assignedByName?: string | null;
}): Promise<SendResult> {
  const emails = await getEmailsForProfiles(opts.profileIds, "assignment");
  if (emails.length === 0) return { sent: 0, failed: 0 };

  // Récupère le contexte enrichi du ticket (priorité, adresse, description,
  // catégorie, commune) pour un email plus utile.
  const service = await createServiceClient();
  const { data: ticket } = await service
    .from("tickets")
    .select(
      "priorite, categorie, adresse, description, commune_id, communes:commune_id ( name )",
    )
    .eq("id", opts.ticketId)
    .maybeSingle();

  type TicketCtx = {
    priorite: "basse" | "normale" | "haute" | "urgente";
    categorie: string;
    adresse: string | null;
    description: string | null;
    communes: { name: string | null } | null;
  };
  const t = ticket as TicketCtx | null;

  const PRIO_LABELS: Record<TicketCtx["priorite"], string> = {
    basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente",
  };
  const PRIO_COLORS: Record<TicketCtx["priorite"], { bg: string; fg: string }> = {
    basse:   { bg: "#E5E7EB", fg: "#4B5563" },
    normale: { bg: "#DBEAFE", fg: "#1E40AF" },
    haute:   { bg: "#FEF3C7", fg: "#92400E" },
    urgente: { bg: "#FEE2E2", fg: "#991B1B" },
  };
  const CATEGORIE_LABELS: Record<string, string> = {
    voirie: "Voirie", espaces_verts: "Espaces verts", batiment: "Bâtiments",
    eclairage_public: "Éclairage public", proprete: "Propreté",
    mobilier_urbain: "Mobilier urbain", reseaux_eau: "Réseaux d'eau",
    signalisation: "Signalisation", autre: "Autre",
  };

  const priorite = t?.priorite ?? "normale";
  const prioColor = PRIO_COLORS[priorite];
  const prioLabel = PRIO_LABELS[priorite];
  const catLabel = t?.categorie ? CATEGORIE_LABELS[t.categorie] ?? t.categorie : null;
  const communeName = t?.communes?.name ?? null;
  const isUrgent = priorite === "urgente";

  const urgentBanner = isUrgent
    ? `<div style="background:#FEE2E2;color:#991B1B;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-weight:600;font-size:13px;">
         ⚠ Ticket à priorité urgente — intervention rapide attendue.
       </div>`
    : "";

  const adresseRow = t?.adresse
    ? `<tr>
         <td style="padding:6px 0;color:#666;font-size:12px;font-weight:600;width:120px;vertical-align:top;">Adresse</td>
         <td style="padding:6px 0;color:#1a2744;font-size:13px;">${escapeHtml(t.adresse)}</td>
       </tr>`
    : "";

  const descBlock = t?.description
    ? `<div style="margin-top:14px;padding:12px 14px;background:#F9FAFB;border-left:3px solid #3B6FA0;border-radius:4px;">
         <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:6px;">Description</div>
         <div style="color:#222;font-size:13px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(t.description)}</div>
       </div>`
    : "";

  const assignedByLine = opts.assignedByName
    ? `<p style="margin:0 0 14px;color:#555;font-size:13px;">Assigné par <strong>${escapeHtml(opts.assignedByName)}</strong></p>`
    : "";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#F5F4EF;color:#1a2744;">
  <div style="background:#1a2744;color:#fff;padding:22px 24px;border-radius:10px 10px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.7;margin-bottom:6px;">
      ${communeName ? escapeHtml(communeName) + " · " : ""}Nouveau ticket assigné
    </div>
    <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
      Ticket #${opts.ticketNumero}
    </h1>
  </div>

  <div style="background:#fff;padding:24px;border:1px solid #e8e5de;border-top:none;border-radius:0 0 10px 10px;">
    ${urgentBanner}

    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#1a2744;font-weight:600;">
      ${escapeHtml(opts.titre)}
    </p>

    ${assignedByLine}

    <div style="margin-bottom:18px;">
      <span style="display:inline-block;padding:4px 12px;border-radius:99px;background:${prioColor.bg};color:${prioColor.fg};font-size:12px;font-weight:700;margin-right:6px;">
        Priorité ${prioLabel}
      </span>
      ${catLabel ? `<span style="display:inline-block;padding:4px 12px;border-radius:99px;background:#F0F0F0;color:#444;font-size:12px;font-weight:600;">${escapeHtml(catLabel)}</span>` : ""}
    </div>

    ${
      t?.adresse
        ? `<table style="width:100%;border-collapse:collapse;font-family:inherit;">
             ${adresseRow}
           </table>`
        : ""
    }

    ${descBlock}

    <p style="margin:24px 0 0;">
      <a href="${opts.ticketUrl}" style="display:inline-block;padding:12px 22px;background:#3B6FA0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Ouvrir le ticket
      </a>
    </p>

    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.5;">
      Vous recevez cet email parce qu'un agent vous a assigné·e à ce ticket
      d'intervention sur la plateforme GoCiviq. Pour gérer vos préférences
      de notifications, ouvrez la rubrique « Notifications » de votre espace.
    </p>
  </div>
</div>`.trim();

  const text = [
    `Ticket #${opts.ticketNumero} vous a été assigné`,
    opts.assignedByName ? `Assigné par ${opts.assignedByName}` : null,
    "",
    opts.titre,
    `Priorité : ${prioLabel}${catLabel ? ` · ${catLabel}` : ""}`,
    t?.adresse ? `Adresse : ${t.adresse}` : null,
    t?.description ? `\n${t.description}` : null,
    "",
    `Ouvrir : ${opts.ticketUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const ok = await sendEmail({
    to: emails,
    subject: `${isUrgent ? "🚨 URGENT — " : ""}Ticket #${opts.ticketNumero} vous a été assigné`,
    html,
    text,
  });

  return { sent: ok ? emails.length : 0, failed: ok ? 0 : emails.length };
}

/**
 * Notification email pour un ticket URGENT NON ASSIGNÉ — envoyé à
 * tous les agents techniques/adjoints de la commune en attente.
 */
export async function sendUrgentUnassignedEmail(opts: {
  profileIds: string[];
  ticketNumero: number;
  titre: string;
  ticketUrl: string;
  adresse?: string | null;
}): Promise<SendResult> {
  const emails = await getEmailsForProfiles(opts.profileIds, "urgent_unassigned");
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const adresseLine = opts.adresse
    ? `<p style="margin:0 0 14px;color:#444;font-size:13px;"><strong>Adresse :</strong> ${escapeHtml(opts.adresse)}</p>`
    : "";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F5F4EF;color:#1a2744;">
  <div style="background:#991B1B;color:#fff;padding:20px 22px;border-radius:10px 10px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.85;margin-bottom:4px;">
      Ticket urgent non assigné
    </div>
    <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
      🚨 #${opts.ticketNumero}
    </h1>
  </div>
  <div style="background:#fff;padding:22px 24px;border:1px solid #e8e5de;border-top:none;border-radius:0 0 10px 10px;">
    <div style="background:#FEE2E2;color:#991B1B;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-weight:600;font-size:13px;">
      ⚠ Aucun agent n'a encore pris en charge ce ticket urgent.
    </div>
    <p style="margin:0 0 14px;font-size:15px;font-weight:600;line-height:1.5;color:#1a2744;">
      ${escapeHtml(opts.titre)}
    </p>
    ${adresseLine}
    <p style="margin:22px 0 0;">
      <a href="${opts.ticketUrl}" style="display:inline-block;padding:12px 22px;background:#991B1B;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Prendre en charge
      </a>
    </p>
    <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.5;">
      Vous recevez cet email en tant qu'agent technique ou adjoint de votre
      commune. Désactivez « Ticket urgent non assigné » dans votre profil
      pour ne plus recevoir ce type de notification.
    </p>
  </div>
</div>`.trim();

  const text = [
    `🚨 URGENT — Ticket #${opts.ticketNumero} non assigné`,
    "",
    opts.titre,
    opts.adresse ? `Adresse : ${opts.adresse}` : null,
    "",
    `Prendre en charge : ${opts.ticketUrl}`,
  ].filter(Boolean).join("\n");

  const ok = await sendEmail({
    to: emails,
    subject: `🚨 URGENT non assigné — Ticket #${opts.ticketNumero}`,
    html,
    text,
  });
  return { sent: ok ? emails.length : 0, failed: ok ? 0 : emails.length };
}

/**
 * Notification email pour un NOUVEAU COMMENTAIRE sur un ticket dont
 * l'utilisateur est assigné.
 */
export async function sendTicketCommentedEmail(opts: {
  profileIds: string[];
  ticketNumero: number;
  titre: string;
  ticketUrl: string;
  authorName?: string | null;
  excerpt: string;
}): Promise<SendResult> {
  const emails = await getEmailsForProfiles(opts.profileIds, "comment");
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const authorLine = opts.authorName
    ? `<p style="margin:0 0 6px;font-size:12px;color:#666;">Posté par <strong>${escapeHtml(opts.authorName)}</strong></p>`
    : "";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F5F4EF;color:#1a2744;">
  <div style="background:#1a2744;color:#fff;padding:20px 22px;border-radius:10px 10px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.7;margin-bottom:4px;">
      Nouveau commentaire
    </div>
    <h1 style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;">
      Ticket #${opts.ticketNumero}
    </h1>
  </div>
  <div style="background:#fff;padding:22px 24px;border:1px solid #e8e5de;border-top:none;border-radius:0 0 10px 10px;">
    <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#1a2744;">
      ${escapeHtml(opts.titre)}
    </p>
    ${authorLine}
    <div style="margin:14px 0;padding:12px 14px;background:#F9FAFB;border-left:3px solid #3B6FA0;border-radius:4px;color:#222;font-size:13px;line-height:1.5;white-space:pre-wrap;">
      ${escapeHtml(opts.excerpt.length > 400 ? opts.excerpt.slice(0, 400) + "…" : opts.excerpt)}
    </div>
    <p style="margin:22px 0 0;">
      <a href="${opts.ticketUrl}" style="display:inline-block;padding:11px 20px;background:#3B6FA0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Voir le ticket
      </a>
    </p>
    <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.5;">
      Vous recevez cet email car vous êtes assigné·e à ce ticket.
      Désactivez « Nouveau commentaire » dans votre profil pour ne plus
      en recevoir.
    </p>
  </div>
</div>`.trim();

  const text = [
    `Nouveau commentaire sur le ticket #${opts.ticketNumero}`,
    opts.authorName ? `Par ${opts.authorName}` : null,
    "",
    opts.titre,
    "",
    opts.excerpt,
    "",
    `Voir : ${opts.ticketUrl}`,
  ].filter(Boolean).join("\n");

  const ok = await sendEmail({
    to: emails,
    subject: `Commentaire — Ticket #${opts.ticketNumero}`,
    html,
    text,
  });
  return { sent: ok ? emails.length : 0, failed: ok ? 0 : emails.length };
}

/**
 * Notification email pour la CLÔTURE d'un ticket — envoyé au créateur
 * du ticket (le signaleur).
 */
export async function sendTicketClosedEmail(opts: {
  profileIds: string[];
  ticketNumero: number;
  titre: string;
  ticketUrl: string;
}): Promise<SendResult> {
  const emails = await getEmailsForProfiles(opts.profileIds, "closure");
  if (emails.length === 0) return { sent: 0, failed: 0 };

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F5F4EF;color:#1a2744;">
  <div style="background:#065F46;color:#fff;padding:20px 22px;border-radius:10px 10px 0 0;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;opacity:0.85;margin-bottom:4px;">
      Ticket résolu
    </div>
    <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;">
      ✅ #${opts.ticketNumero}
    </h1>
  </div>
  <div style="background:#fff;padding:22px 24px;border:1px solid #e8e5de;border-top:none;border-radius:0 0 10px 10px;">
    <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#1a2744;">
      ${escapeHtml(opts.titre)}
    </p>
    <p style="margin:0 0 14px;font-size:13px;color:#444;line-height:1.5;">
      L'intervention a été clôturée. Un rapport d'intervention a été rédigé
      et est consultable depuis le ticket.
    </p>
    <p style="margin:22px 0 0;">
      <a href="${opts.ticketUrl}" style="display:inline-block;padding:11px 20px;background:#065F46;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Voir le rapport
      </a>
    </p>
    <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#888;line-height:1.5;">
      Vous recevez cet email parce que vous avez signalé ce ticket.
      Désactivez « Clôture de mon ticket » dans votre profil pour ne plus
      en recevoir.
    </p>
  </div>
</div>`.trim();

  const text = [
    `✅ Ticket #${opts.ticketNumero} résolu`,
    "",
    opts.titre,
    "",
    `Voir le rapport : ${opts.ticketUrl}`,
  ].join("\n");

  const ok = await sendEmail({
    to: emails,
    subject: `✅ Ticket #${opts.ticketNumero} résolu — ${opts.titre.slice(0, 60)}`,
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

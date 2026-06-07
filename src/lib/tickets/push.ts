import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase-server";
import { sendOptInSms } from "@/lib/notifications/sms";

// ═══════════════════════════════════════════════════════════════
// Wrapper d'envoi Web Push
//
//   sendTicketNotification({ profileIds, title, body, ticketId })
//
// • récupère toutes les souscriptions des profils ciblés
// • envoie en parallèle via Promise.allSettled
// • supprime les souscriptions invalides (410 Gone, 404 Not Found)
//
// Toutes les notifs incluent un deep link vers le ticket pour
// que le tap ouvre directement la bonne page côté PWA.
// ═══════════════════════════════════════════════════════════════

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@gociviq.fr";
  if (!pub || !priv) {
    console.warn("[push] VAPID keys manquantes — notifications désactivées");
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export interface NotifyInput {
  /** IDs des destinataires (profiles.id) */
  profileIds: string[];
  /** Titre de la notification */
  title: string;
  /** Corps */
  body: string;
  /** Lien à ouvrir au tap (chemin relatif ou URL absolue) */
  url: string;
  /** Tag pour fusionner les notifs identiques (optionnel) */
  tag?: string;
  /** Catégorie pour filtrer selon notification_preferences */
  category?: "assignment" | "urgent_unassigned" | "comment" | "closure" | "reopen";
}

interface SendResult {
  sent: number;
  failed: number;
  cleaned: number;
}

export async function sendTicketNotification(input: NotifyInput): Promise<SendResult> {
  if (!configureVapid()) return { sent: 0, failed: 0, cleaned: 0 };
  if (input.profileIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  // Filtrer par préférence (push_enabled + notify_<category>) si catégorie fournie
  let targetIds = input.profileIds;
  if (input.category) {
    const service = await createServiceClient();
    const { data: prefs } = await service
      .from("notification_preferences")
      .select(
        "profile_id, push_enabled, notify_assignment, notify_urgent_unassigned, notify_comment, notify_closure",
      )
      .in("profile_id", input.profileIds);
    const map = new Map<string, Record<string, boolean>>();
    for (const p of prefs ?? []) map.set(p.profile_id, p);
    targetIds = input.profileIds.filter((id) => {
      const p = map.get(id);
      if (!p) return true; // pas de ligne → defaults DB true
      if (p.push_enabled === false) return false;
      switch (input.category) {
        case "assignment": return p.notify_assignment;
        case "urgent_unassigned": return p.notify_urgent_unassigned;
        case "comment": return p.notify_comment;
        case "closure": return p.notify_closure;
        case "reopen": return p.notify_assignment;
        default: return true;
      }
    });
    if (targetIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };
  }

  const service = await createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, profile_id")
    .in("profile_id", targetIds);

  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh_key, auth: s.auth_key },
        },
        payload
      )
    )
  );

  let sent = 0;
  let failed = 0;
  const toDelete: string[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const sub = subs[i];
      const err = r.reason as { statusCode?: number };
      const code = err?.statusCode;
      // 410 Gone = subscription expirée ; 404 Not Found = idem
      if (code === 410 || code === 404) {
        toDelete.push(sub.id);
      }
    }
  });

  if (toDelete.length > 0) {
    await service.from("push_subscriptions").delete().in("id", toDelete);
  }

  return { sent, failed, cleaned: toDelete.length };
}

// ─── Helpers haut-niveau pour les déclencheurs métier ───

/** Notif lors d'une assignation directe à un agent. Envoie push + email + SMS. */
export async function notifyTicketAssigned(opts: {
  ticketId: string;
  ticketNumero: number;
  titre: string;
  assignedTo: string;
  /** Soit le nom déjà résolu, soit l'id du profil pour résolution auto. */
  assignedByName?: string | null;
  assignedByUserId?: string | null;
}) {
  // Résolution paresseuse du nom de l'assignateur si seulement l'ID fourni
  let assignedByName = opts.assignedByName ?? null;
  if (!assignedByName && opts.assignedByUserId) {
    try {
      const service = await createServiceClient();
      const { data } = await service
        .from("profiles")
        .select("full_name")
        .eq("id", opts.assignedByUserId)
        .maybeSingle();
      assignedByName = data?.full_name ?? null;
    } catch (e) {
      console.warn("[email] lookup assignedByName failed:", e);
    }
  }

  const push = sendTicketNotification({
    profileIds: [opts.assignedTo],
    title: `Ticket #${opts.ticketNumero} vous a été assigné`,
    body: opts.titre.length > 100 ? opts.titre.slice(0, 100) + "…" : opts.titre,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `ticket-${opts.ticketId}`,
    category: "assignment",
  });

  // Email transactionnel (lazy import pour éviter un cycle si Resend pas configuré)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.gociviq.fr";
  const ticketUrl = `${baseUrl}/admin/tickets/${opts.ticketId}`;
  import("@/lib/notifications/email")
    .then(({ sendTicketAssignedEmail }) =>
      sendTicketAssignedEmail({
        profileIds: [opts.assignedTo],
        ticketId: opts.ticketId,
        ticketNumero: opts.ticketNumero,
        titre: opts.titre,
        ticketUrl,
        assignedByName,
      }),
    )
    .catch((e) => console.error("[email] assigned:", e));

  // SMS opt-in en parallèle (pas bloquant si Twilio indispo)
  sendOptInSms({
    profileIds: [opts.assignedTo],
    category: "assignment",
    body: `[GoCiviq] Ticket #${opts.ticketNumero} vous a été assigné : ${opts.titre.slice(0, 80)}`,
  }).catch(() => {});
  return push;
}

/** Notif quand un ticket urgent est créé sans assignation : tous les agents techniques + adjoints travaux. */
export async function notifyUrgentUnassigned(opts: {
  ticketId: string;
  ticketNumero: number;
  titre: string;
  communeId: string;
  adresse?: string | null;
}) {
  const service = await createServiceClient();
  const { data: targets } = await service
    .from("profiles")
    .select("id")
    .eq("commune_id", opts.communeId)
    .or("job_title.eq.agent_technique,job_title.eq.adjoint,role.eq.admin");

  const ids = (targets ?? []).map((t) => t.id);
  const push = sendTicketNotification({
    profileIds: ids,
    title: `🚨 Ticket urgent #${opts.ticketNumero}`,
    body: opts.titre,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `urgent-${opts.ticketId}`,
    category: "urgent_unassigned",
  });

  // Email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.gociviq.fr";
  const ticketUrl = `${baseUrl}/admin/tickets/${opts.ticketId}`;
  import("@/lib/notifications/email")
    .then(({ sendUrgentUnassignedEmail }) =>
      sendUrgentUnassignedEmail({
        profileIds: ids,
        ticketNumero: opts.ticketNumero,
        titre: opts.titre,
        ticketUrl,
        adresse: opts.adresse ?? null,
      }),
    )
    .catch((e) => console.error("[email] urgent:", e));

  sendOptInSms({
    profileIds: ids,
    category: "urgent_unassigned",
    body: `[GoCiviq] URGENT #${opts.ticketNumero} : ${opts.titre.slice(0, 100)}`,
  }).catch(() => {});
  return push;
}

/** Notif quand un commentaire est ajouté sur un ticket en cours : agent assigné. */
export async function notifyTicketCommented(opts: {
  ticketId: string;
  ticketNumero: number;
  titre?: string;
  assignedTo: string | null;
  excerpt: string;
  authorUserId?: string | null;
}) {
  if (!opts.assignedTo) return { sent: 0, failed: 0, cleaned: 0 };
  const push = sendTicketNotification({
    profileIds: [opts.assignedTo],
    title: `Nouveau commentaire sur #${opts.ticketNumero}`,
    body: opts.excerpt.length > 120 ? opts.excerpt.slice(0, 120) + "…" : opts.excerpt,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `comment-${opts.ticketId}`,
    category: "comment",
  });

  // Email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.gociviq.fr";
  const ticketUrl = `${baseUrl}/admin/tickets/${opts.ticketId}`;

  // Résout le nom de l'auteur si fourni en ID
  let authorName: string | null = null;
  if (opts.authorUserId) {
    try {
      const service = await createServiceClient();
      const { data } = await service
        .from("profiles")
        .select("full_name")
        .eq("id", opts.authorUserId)
        .maybeSingle();
      authorName = data?.full_name ?? null;
    } catch (e) {
      console.warn("[email] lookup authorName failed:", e);
    }
  }

  // Récupère le titre du ticket si pas fourni
  let titre = opts.titre;
  if (!titre) {
    const service = await createServiceClient();
    const { data: t } = await service
      .from("tickets")
      .select("titre")
      .eq("id", opts.ticketId)
      .maybeSingle();
    titre = t?.titre ?? `Ticket #${opts.ticketNumero}`;
  }

  import("@/lib/notifications/email")
    .then(({ sendTicketCommentedEmail }) =>
      sendTicketCommentedEmail({
        profileIds: [opts.assignedTo!],
        ticketNumero: opts.ticketNumero,
        titre: titre!,
        ticketUrl,
        authorName,
        excerpt: opts.excerpt,
      }),
    )
    .catch((e) => console.error("[email] comment:", e));

  sendOptInSms({
    profileIds: [opts.assignedTo],
    category: "comment",
    body: `[GoCiviq] Commentaire ticket #${opts.ticketNumero}`,
  }).catch(() => {});
  return push;
}

/** Notif quand un ticket est clôturé : créateur du ticket. */
export async function notifyTicketClosed(opts: { ticketId: string; ticketNumero: number; titre: string; createdBy: string | null }) {
  if (!opts.createdBy) return { sent: 0, failed: 0, cleaned: 0 };
  const push = sendTicketNotification({
    profileIds: [opts.createdBy],
    title: `✅ Ticket #${opts.ticketNumero} résolu`,
    body: `${opts.titre} — voir le rapport d'intervention`,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `closed-${opts.ticketId}`,
    category: "closure",
  });

  // Email
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.gociviq.fr";
  const ticketUrl = `${baseUrl}/admin/tickets/${opts.ticketId}`;
  import("@/lib/notifications/email")
    .then(({ sendTicketClosedEmail }) =>
      sendTicketClosedEmail({
        profileIds: [opts.createdBy!],
        ticketNumero: opts.ticketNumero,
        titre: opts.titre,
        ticketUrl,
      }),
    )
    .catch((e) => console.error("[email] closed:", e));

  sendOptInSms({
    profileIds: [opts.createdBy],
    category: "closure",
    body: `[GoCiviq] Ticket #${opts.ticketNumero} résolu : ${opts.titre.slice(0, 90)}`,
  }).catch(() => {});
  return push;
}

/**
 * Notif quand un ticket est rouvert automatiquement par le cron de suivi.
 * Cible : tous les agents qui étaient assignés au moment de la clôture.
 * Envoie push + email (Resend si configuré) + SMS opt-in.
 */
export async function notifyTicketReopened(opts: {
  ticketId: string;
  ticketNumero: number;
  titre: string;
  assigneeIds: string[];
  reason?: string | null;
  baseUrl: string;
}) {
  if (opts.assigneeIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const ticketUrl = `${opts.baseUrl}/admin/tickets/${opts.ticketId}`;

  // Push
  const push = sendTicketNotification({
    profileIds: opts.assigneeIds,
    title: `🔄 Ticket #${opts.ticketNumero} rouvert`,
    body: opts.reason
      ? `${opts.titre} — ${opts.reason.slice(0, 80)}`
      : `${opts.titre} — suivi programmé`,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `reopen-${opts.ticketId}`,
    category: "reopen",
  });

  // Email (lazy import pour éviter un cycle d'import si Resend pas configuré)
  import("@/lib/notifications/email")
    .then(({ sendTicketReopenedEmail }) =>
      sendTicketReopenedEmail({
        profileIds: opts.assigneeIds,
        ticketNumero: opts.ticketNumero,
        titre: opts.titre,
        ticketUrl,
        reason: opts.reason,
      }),
    )
    .catch((e) => console.error("[email] reopen:", e));

  // SMS opt-in
  sendOptInSms({
    profileIds: opts.assigneeIds,
    category: "reopen",
    body: `[GoCiviq] 🔄 Ticket #${opts.ticketNumero} rouvert : ${opts.titre.slice(0, 80)}`,
  }).catch(() => {});

  return push;
}

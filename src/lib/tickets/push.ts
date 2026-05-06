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
}

interface SendResult {
  sent: number;
  failed: number;
  cleaned: number;
}

export async function sendTicketNotification(input: NotifyInput): Promise<SendResult> {
  if (!configureVapid()) return { sent: 0, failed: 0, cleaned: 0 };
  if (input.profileIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const service = await createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, profile_id")
    .in("profile_id", input.profileIds);

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

/** Notif lors d'une assignation directe à un agent. */
export async function notifyTicketAssigned(opts: { ticketId: string; ticketNumero: number; titre: string; assignedTo: string }) {
  const push = sendTicketNotification({
    profileIds: [opts.assignedTo],
    title: `Ticket #${opts.ticketNumero} vous a été assigné`,
    body: opts.titre.length > 100 ? opts.titre.slice(0, 100) + "…" : opts.titre,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `ticket-${opts.ticketId}`,
  });
  // SMS opt-in en parallèle (pas bloquant si Twilio indispo)
  sendOptInSms({
    profileIds: [opts.assignedTo],
    category: "assignment",
    body: `[GoCiviq] Ticket #${opts.ticketNumero} vous a été assigné : ${opts.titre.slice(0, 80)}`,
  }).catch(() => {});
  return push;
}

/** Notif quand un ticket urgent est créé sans assignation : tous les agents techniques + adjoints travaux. */
export async function notifyUrgentUnassigned(opts: { ticketId: string; ticketNumero: number; titre: string; communeId: string }) {
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
  });
  sendOptInSms({
    profileIds: ids,
    category: "urgent_unassigned",
    body: `[GoCiviq] URGENT #${opts.ticketNumero} : ${opts.titre.slice(0, 100)}`,
  }).catch(() => {});
  return push;
}

/** Notif quand un commentaire est ajouté sur un ticket en cours : agent assigné. */
export async function notifyTicketCommented(opts: { ticketId: string; ticketNumero: number; assignedTo: string | null; excerpt: string }) {
  if (!opts.assignedTo) return { sent: 0, failed: 0, cleaned: 0 };
  const push = sendTicketNotification({
    profileIds: [opts.assignedTo],
    title: `Nouveau commentaire sur #${opts.ticketNumero}`,
    body: opts.excerpt.length > 120 ? opts.excerpt.slice(0, 120) + "…" : opts.excerpt,
    url: `/admin/tickets/${opts.ticketId}`,
    tag: `comment-${opts.ticketId}`,
  });
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
  });
  sendOptInSms({
    profileIds: [opts.createdBy],
    category: "closure",
    body: `[GoCiviq] Ticket #${opts.ticketNumero} résolu : ${opts.titre.slice(0, 90)}`,
  }).catch(() => {});
  return push;
}

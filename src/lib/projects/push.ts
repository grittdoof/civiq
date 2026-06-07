import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase-server";
import { sendOptInSms } from "@/lib/notifications/sms";
import { sendEmail } from "@/lib/notifications/email";
import { PROJECT_PHASE_LABELS, FINANCING_STATUS_LABELS } from "./types";
import type { ProjectPhase, FinancingStatus } from "./types";

// ═══════════════════════════════════════════════════════════════
// Notifications du module Gestion de projet.
//
// Réutilise la table push_subscriptions du module tickets +
// notification_preferences (étendu par la migration 017 :
// notify_project_phase, notify_project_milestone,
// notify_project_financing, notify_commission).
//
// Toutes les fonctions sont best-effort et ne lèvent jamais —
// même pattern que sendTicketNotification.
// ═══════════════════════════════════════════════════════════════

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@gociviq.fr";
  if (!pub || !priv) {
    console.warn("[push:projects] VAPID keys manquantes — notifications désactivées");
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export type ProjectNotifCategory =
  | "project_phase"
  | "project_milestone"
  | "project_financing"
  | "commission";

const CATEGORY_TO_PREF: Record<ProjectNotifCategory, string> = {
  project_phase: "notify_project_phase",
  project_milestone: "notify_project_milestone",
  project_financing: "notify_project_financing",
  commission: "notify_commission",
};

type SmsCategory = "assignment" | "urgent_unassigned" | "comment" | "closure" | "reopen";
const CATEGORY_TO_SMS: Record<ProjectNotifCategory, SmsCategory> = {
  // Réutilise la catégorie SMS la plus proche déjà câblée en BDD
  project_phase: "assignment",
  project_milestone: "assignment",
  project_financing: "assignment",
  commission: "assignment",
};

export interface ProjectNotifyInput {
  profileIds: string[];
  title: string;
  body: string;
  url: string;
  tag?: string;
  category: ProjectNotifCategory;
}

interface PushSendResult {
  sent: number;
  failed: number;
  cleaned: number;
}

export async function sendProjectNotification(
  input: ProjectNotifyInput,
): Promise<PushSendResult> {
  if (!configureVapid()) return { sent: 0, failed: 0, cleaned: 0 };
  if (input.profileIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  // Filtrer par préférence
  const service = await createServiceClient();
  const prefCol = CATEGORY_TO_PREF[input.category];
  // .select() typed via cast (la string dynamique fait perdre l'inférence)
  const { data: prefs } = (await service
    .from("notification_preferences")
    .select(`profile_id, push_enabled, ${prefCol}`)
    .in("profile_id", input.profileIds)) as unknown as {
      data: Array<Record<string, unknown>> | null;
    };
  const prefMap = new Map<string, Record<string, boolean>>();
  for (const p of prefs ?? []) {
    prefMap.set(p.profile_id as string, p as unknown as Record<string, boolean>);
  }
  const targetIds = input.profileIds.filter((id) => {
    const p = prefMap.get(id);
    if (!p) return true; // pas de ligne → defaults DB true
    if (p.push_enabled === false) return false;
    return p[prefCol] !== false;
  });
  if (targetIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, profile_id")
    .in("profile_id", targetIds);
  if (!subs || subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
        payload,
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const toDelete: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else {
      failed++;
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) toDelete.push(subs[i].id);
    }
  });
  if (toDelete.length > 0) {
    await service.from("push_subscriptions").delete().in("id", toDelete);
  }
  return { sent, failed, cleaned: toDelete.length };
}

// ─── Récupère les abonnés d'un projet ───
async function getProjectSubscribers(projectId: string): Promise<string[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("project_subscribers")
    .select("user_id")
    .eq("project_id", projectId);
  return (data ?? []).map((r) => r.user_id as string);
}

// ─── Récupère l'URL absolue de base ───
function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "https://www.gociviq.fr"
  );
}

async function getEmails(profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const service = await createServiceClient();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (!users?.users) return [];
  return users.users
    .filter((u) => profileIds.includes(u.id) && u.email && u.email_confirmed_at)
    .map((u) => u.email as string);
}

// ═══════════════════════════════════════════════════════════════
// Helpers haut-niveau (déclencheurs métier)
// ═══════════════════════════════════════════════════════════════

/** Changement de phase d'un projet. Notifie les abonnés (pilotes inclus). */
export async function notifyProjectPhaseChanged(opts: {
  projectId: string;
  fromPhase: ProjectPhase;
  toPhase: ProjectPhase;
  actorUserId: string;
}): Promise<void> {
  try {
    const service = await createServiceClient();
    const { data: project } = await service
      .from("projects")
      .select("titre")
      .eq("id", opts.projectId)
      .maybeSingle();
    const titre = project?.titre ?? "Projet";

    const subs = await getProjectSubscribers(opts.projectId);
    const recipients = subs.filter((id) => id !== opts.actorUserId);
    if (recipients.length === 0) return;

    const fromLabel = PROJECT_PHASE_LABELS[opts.fromPhase];
    const toLabel = PROJECT_PHASE_LABELS[opts.toPhase];
    const url = `/admin/projects/${opts.projectId}`;

    const push = sendProjectNotification({
      profileIds: recipients,
      title: `${titre} — passage en ${toLabel}`,
      body: `Le projet est passé de « ${fromLabel} » à « ${toLabel} ».`,
      url,
      tag: `project-phase-${opts.projectId}`,
      category: "project_phase",
    });

    const emails = await getEmails(recipients);
    if (emails.length > 0) {
      sendEmail({
        to: emails,
        subject: `[GoCiviq] ${titre} — passage en ${toLabel}`,
        html: `<p>Bonjour,</p>
<p>Le projet <strong>${escapeHtml(titre)}</strong> est passé de l'étape <em>${escapeHtml(fromLabel)}</em> à <em>${escapeHtml(toLabel)}</em>.</p>
<p><a href="${baseUrl()}${url}">Voir la fiche projet</a></p>`,
      }).catch((e) => console.error("[email] project_phase:", e));
    }

    sendOptInSms({
      profileIds: recipients,
      category: CATEGORY_TO_SMS.project_phase,
      body: `[GoCiviq] Projet « ${titre.slice(0, 60)} » → ${toLabel}`,
    }).catch(() => {});

    await push;
  } catch (e) {
    console.error("[push] notifyProjectPhaseChanged:", e);
  }
}

/** Changement de statut d'une subvention (accordée / refusée). */
export async function notifyFinancingStatusChange(opts: {
  projectId: string;
  financingId: string;
  financeur: string;
  newStatus: FinancingStatus;
}): Promise<void> {
  try {
    const service = await createServiceClient();
    const { data: project } = await service
      .from("projects")
      .select("titre")
      .eq("id", opts.projectId)
      .maybeSingle();
    const titre = project?.titre ?? "Projet";
    const subs = await getProjectSubscribers(opts.projectId);
    if (subs.length === 0) return;

    const statusLabel = FINANCING_STATUS_LABELS[opts.newStatus];
    const url = `/admin/projects/${opts.projectId}`;
    const emoji =
      opts.newStatus === "accordee" ? "✅" :
      opts.newStatus === "refusee" ? "❌" : "ℹ️";

    const push = sendProjectNotification({
      profileIds: subs,
      title: `${emoji} ${titre} — subvention ${statusLabel}`,
      body: `Financeur : ${opts.financeur}`,
      url,
      tag: `project-financing-${opts.financingId}`,
      category: "project_financing",
    });

    const emails = await getEmails(subs);
    if (emails.length > 0) {
      sendEmail({
        to: emails,
        subject: `[GoCiviq] ${titre} — subvention ${statusLabel}`,
        html: `<p>Bonjour,</p>
<p>Le financement « <strong>${escapeHtml(opts.financeur)}</strong> » du projet <strong>${escapeHtml(titre)}</strong> est désormais au statut <em>${escapeHtml(statusLabel)}</em>.</p>
<p><a href="${baseUrl()}${url}">Voir le plan de financement</a></p>`,
      }).catch((e) => console.error("[email] financing:", e));
    }

    await push;
  } catch (e) {
    console.error("[push] notifyFinancingStatusChange:", e);
  }
}

/** Jalon à échéance proche (J-7, J-0) ou en retard. Cron friendly. */
export async function notifyMilestoneDue(opts: {
  projectId: string;
  milestoneId: string;
  libelle: string;
  echeance: string;
  daysToDue: number; // négatif = retard
}): Promise<void> {
  try {
    const subs = await getProjectSubscribers(opts.projectId);
    if (subs.length === 0) return;

    const url = `/admin/projects/${opts.projectId}`;
    let title: string;
    let body: string;
    if (opts.daysToDue < 0) {
      title = `⏰ Jalon en retard : ${opts.libelle}`;
      body = `Échéance dépassée de ${Math.abs(opts.daysToDue)} jour(s).`;
    } else if (opts.daysToDue === 0) {
      title = `📌 Jalon aujourd'hui : ${opts.libelle}`;
      body = "Le jalon arrive à échéance aujourd'hui.";
    } else {
      title = `📅 Jalon dans ${opts.daysToDue} jours : ${opts.libelle}`;
      body = `Échéance prévue le ${new Date(opts.echeance).toLocaleDateString("fr-FR")}.`;
    }

    await sendProjectNotification({
      profileIds: subs,
      title,
      body,
      url,
      tag: `milestone-${opts.milestoneId}`,
      category: "project_milestone",
    });
  } catch (e) {
    console.error("[push] notifyMilestoneDue:", e);
  }
}

/** Ticket transformé en projet — notifie le créateur du ticket + pilotes. */
export async function notifyTicketTransformedToProject(opts: {
  projectId: string;
  ticketId: string;
  ticketNumero: number;
  pilotes: string[];
  ticketCreator: string | null;
}): Promise<void> {
  try {
    const ids = new Set<string>();
    opts.pilotes.forEach((p) => p && ids.add(p));
    if (opts.ticketCreator) ids.add(opts.ticketCreator);
    if (ids.size === 0) return;

    await sendProjectNotification({
      profileIds: [...ids],
      title: `🚀 Ticket #${opts.ticketNumero} transformé en projet`,
      body: "Un nouveau projet a été créé à partir de ce ticket.",
      url: `/admin/projects/${opts.projectId}`,
      tag: `ticket-project-${opts.ticketId}`,
      category: "project_phase",
    });
  } catch (e) {
    console.error("[push] notifyTicketTransformedToProject:", e);
  }
}

/** Convocation à une séance de commission. À envoyer à la planification + J-1. */
export async function notifyCommissionConvocation(opts: {
  sessionId: string;
  commissionName: string;
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  memberUserIds: string[];
  isReminder?: boolean;
}): Promise<void> {
  try {
    if (opts.memberUserIds.length === 0) return;
    const dateLabel = new Date(opts.dateSeance).toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const url = `/admin/commissions`;
    const title = opts.isReminder
      ? `🔔 Rappel : ${opts.commissionName} demain`
      : `📣 Convocation : ${opts.commissionName}`;
    const body = `${dateLabel}${opts.lieu ? ` — ${opts.lieu}` : ""}`;

    const push = sendProjectNotification({
      profileIds: opts.memberUserIds,
      title,
      body,
      url,
      tag: `commission-session-${opts.sessionId}`,
      category: "commission",
    });

    const emails = await getEmails(opts.memberUserIds);
    if (emails.length > 0) {
      sendEmail({
        to: emails,
        subject: `[GoCiviq] ${title}`,
        html: `<p>Bonjour,</p>
<p><strong>${escapeHtml(opts.commissionName)}</strong></p>
<p>Date : ${escapeHtml(dateLabel)}<br/>
${opts.lieu ? `Lieu : ${escapeHtml(opts.lieu)}<br/>` : ""}</p>
${opts.ordreDuJour ? `<p><strong>Ordre du jour</strong><br/>${escapeHtml(opts.ordreDuJour).replace(/\n/g, "<br/>")}</p>` : ""}
<p><a href="${baseUrl()}${url}">Voir la commission</a></p>`,
      }).catch((e) => console.error("[email] commission:", e));
    }

    await push;
  } catch (e) {
    console.error("[push] notifyCommissionConvocation:", e);
  }
}

/** Compte rendu de séance validé — verrouillé et exportable. */
export async function notifyCommissionMinutesValidated(opts: {
  sessionId: string;
  commissionName: string;
  memberUserIds: string[];
}): Promise<void> {
  try {
    if (opts.memberUserIds.length === 0) return;
    await sendProjectNotification({
      profileIds: opts.memberUserIds,
      title: `📄 Compte rendu disponible : ${opts.commissionName}`,
      body: "Le compte rendu a été validé. Vous pouvez le consulter et l'exporter en PDF.",
      url: `/admin/commissions`,
      tag: `commission-cr-${opts.sessionId}`,
      category: "commission",
    });
  } catch (e) {
    console.error("[push] notifyCommissionMinutesValidated:", e);
  }
}

// ─── util ───

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ═══════════════════════════════════════════════════════════════
// Convocations de séance — résolution des destinataires + envoi
//
// Destinataires = TOUS les membres de la commission :
//   • membres avec compte GoCiviq → email du compte (auth.users) ;
//   • membres externes (sans compte) → commission_members.external_email.
// Un membre sans email est remonté en « skipped » pour que l'UI le
// signale (au lieu d'être oublié silencieusement, comme avant).
//
// Chaque destinataire a une ligne `session_convocations` avec un jeton
// personnel : les liens de l'email (réponse, .ics) fonctionnent sans
// compte ni connexion.
//
// Côté serveur uniquement (service role).
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmailBatch } from "@/lib/email";
import { buildConvocationEmail, type ConvocationCommune } from "@/lib/emails/commission-convocation";
import {
  formatSessionDate,
  generateConvocationToken,
  googleCalendarUrl,
  outlookCalendarUrl,
  richTextToPlain,
  type SessionCalendarInput,
} from "./convocation";

export type ConvocationStatus = "pending" | "accepted" | "declined";

export interface ConvocationRecipient {
  member_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  isExternal: boolean;
  convocation: {
    status: ConvocationStatus;
    sent_at: string | null;
    send_count: number;
    responded_at: string | null;
    response_comment: string | null;
    last_error: string | null;
  } | null;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  external_name: string | null;
  external_email: string | null;
  profile: { full_name: string | null } | null;
}

interface ConvocationRow {
  id: string;
  commission_member_id: string;
  token: string;
  status: ConvocationStatus;
  sent_at: string | null;
  send_count: number;
  responded_at: string | null;
  response_comment: string | null;
  last_error: string | null;
}

/** Membres d'une commission + email résolu (+ état de convocation si séance). */
export async function listConvocationRecipients(
  service: SupabaseClient,
  commissionId: string,
  sessionId?: string,
): Promise<ConvocationRecipient[]> {
  const { data: membersData } = await service
    .from("commission_members")
    .select("id, user_id, external_name, external_email, profile:profiles ( full_name )")
    .eq("commission_id", commissionId)
    .is("deleted_at", null)
    .order("created_at");
  const members = (membersData ?? []) as unknown as MemberRow[];

  // Emails des comptes : un appel ciblé par membre interne (pas de
  // listUsers paginé à 1000 qui raterait des comptes).
  const accountEmails = new Map<string, string | null>();
  await Promise.all(
    members
      .filter((m) => m.user_id)
      .map(async (m) => {
        const { data } = await service.auth.admin.getUserById(m.user_id!);
        accountEmails.set(m.user_id!, data?.user?.email ?? null);
      }),
  );

  const convocations = new Map<string, ConvocationRow>();
  if (sessionId) {
    const { data } = await service
      .from("session_convocations")
      .select("id, commission_member_id, token, status, sent_at, send_count, responded_at, response_comment, last_error")
      .eq("session_id", sessionId);
    for (const c of (data ?? []) as ConvocationRow[]) convocations.set(c.commission_member_id, c);
  }

  return members.map((m) => {
    const email = m.user_id
      ? accountEmails.get(m.user_id) ?? m.external_email ?? null
      : m.external_email?.trim() || null;
    const c = convocations.get(m.id);
    return {
      member_id: m.id,
      user_id: m.user_id,
      name: m.profile?.full_name?.trim() || m.external_name?.trim() || email || "Membre",
      email,
      isExternal: !m.user_id,
      convocation: c
        ? {
            status: c.status,
            sent_at: c.sent_at,
            send_count: c.send_count,
            responded_at: c.responded_at,
            response_comment: c.response_comment,
            last_error: c.last_error,
          }
        : null,
    };
  });
}

export interface SendConvocationsResult {
  sent: { name: string; email: string }[];
  failed: { name: string; email: string }[];
  skipped: { name: string; reason: "no_email" }[];
  emailConfigured: boolean;
}

/** Données publiques nécessaires à l'email et aux liens agenda. */
export async function loadSessionContext(service: SupabaseClient, sessionId: string) {
  const { data } = await service
    .from("commission_sessions")
    .select(
      "id, commission_id, date_seance, lieu, ordre_du_jour, commission:commissions ( id, nom, commune_id, commune:communes ( name, logo_url, address, code_postal, phone, contact_email, website_url ) )",
    )
    .is("deleted_at", null)
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;
  type Row = {
    id: string;
    commission_id: string;
    date_seance: string;
    lieu: string | null;
    ordre_du_jour: string | null;
    commission: { id: string; nom: string; commune_id: string; commune: ConvocationCommune | null } | null;
  };
  const row = data as unknown as Row;
  if (!row.commission) return null;
  return row;
}

export type SessionContext = NonNullable<Awaited<ReturnType<typeof loadSessionContext>>>;

export function calendarInputFor(ctx: SessionContext, replyUrl?: string): SessionCalendarInput {
  const commune = ctx.commission?.commune;
  return {
    sessionId: ctx.id,
    title: `Commission ${ctx.commission?.nom ?? ""}`.trim(),
    dateSeance: ctx.date_seance,
    location: ctx.lieu,
    description: richTextToPlain(ctx.ordre_du_jour)
      ? `Ordre du jour :\n${richTextToPlain(ctx.ordre_du_jour)}`
      : null,
    url: replyUrl ?? null,
    organizerName: commune ? `Mairie de ${commune.name}` : null,
    organizerEmail: commune?.contact_email ?? null,
  };
}

/**
 * Envoie (ou renvoie) la convocation aux membres choisis.
 * `memberIds` absent = tous les membres de la commission.
 */
export async function sendSessionConvocations(opts: {
  service: SupabaseClient;
  sessionId: string;
  memberIds?: string[] | null;
  isReminder?: boolean;
}): Promise<SendConvocationsResult | null> {
  const { service, sessionId } = opts;
  const ctx = await loadSessionContext(service, sessionId);
  if (!ctx?.commission) return null;
  const commune: ConvocationCommune = ctx.commission.commune ?? { name: "votre commune" };

  let recipients = await listConvocationRecipients(service, ctx.commission.id, sessionId);
  if (opts.memberIds && opts.memberIds.length > 0) {
    const wanted = new Set(opts.memberIds);
    recipients = recipients.filter((r) => wanted.has(r.member_id));
  }

  const result: SendConvocationsResult = {
    sent: [],
    failed: [],
    skipped: [],
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  };
  const withEmail = recipients.filter((r) => {
    if (r.email) return true;
    result.skipped.push({ name: r.name, reason: "no_email" });
    return false;
  });
  if (withEmail.length === 0) return result;

  // Jeton : réutilise celui d'un envoi précédent (les anciens liens
  // restent valides), sinon en crée un.
  const { data: existing } = await service
    .from("session_convocations")
    .select("commission_member_id, token")
    .eq("session_id", sessionId);
  const tokens = new Map<string, string>(
    ((existing ?? []) as { commission_member_id: string; token: string }[]).map((c) => [
      c.commission_member_id,
      c.token,
    ]),
  );
  const toInsert = withEmail
    .filter((r) => !tokens.has(r.member_id))
    .map((r) => {
      const token = generateConvocationToken();
      tokens.set(r.member_id, token);
      return { session_id: sessionId, commission_member_id: r.member_id, email: r.email, token };
    });
  if (toInsert.length > 0) {
    const { error } = await service.from("session_convocations").insert(toInsert);
    if (error) throw new Error(`session_convocations: ${error.message}`);
  }

  const base = getBaseUrl();
  const dateLabel = formatSessionDate(ctx.date_seance);
  const emails = withEmail.map((r) => {
    const token = tokens.get(r.member_id)!;
    const replyUrl = `${base}/convocation/${token}`;
    const cal = calendarInputFor(ctx, replyUrl);
    const built = buildConvocationEmail({
      siteUrl: base,
      commune,
      commissionName: ctx.commission!.nom,
      recipientName: r.name,
      dateLabel,
      lieu: ctx.lieu,
      ordreDuJourHtml: ctx.ordre_du_jour,
      acceptUrl: `${replyUrl}?reponse=present`,
      declineUrl: `${replyUrl}?reponse=absent`,
      icsUrl: `${base}/api/convocations/${token}/ics`,
      googleUrl: googleCalendarUrl(cal),
      outlookUrl: outlookCalendarUrl(cal),
      isReminder: opts.isReminder,
    });
    return {
      to: r.email!,
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: commune.contact_email ?? undefined,
    };
  });

  const { sent, error } = await sendEmailBatch(emails);
  const now = new Date().toISOString();

  await Promise.all(
    withEmail.map((r, i) => {
      const ok = sent[i];
      (ok ? result.sent : result.failed).push({ name: r.name, email: r.email! });
      return service
        .from("session_convocations")
        .update({
          email: r.email,
          ...(ok
            ? { sent_at: now, send_count: (r.convocation?.send_count ?? 0) + 1, last_error: null }
            : { last_error: error ?? "send_failed" }),
          updated_at: now,
        })
        .eq("session_id", sessionId)
        .eq("commission_member_id", r.member_id);
    }),
  );

  if (result.sent.length > 0) {
    await service.from("commission_sessions").update({ convocation_sent_at: now }).eq("id", sessionId);
  }

  // Push aux membres avec compte (best-effort, n'impacte pas le résultat)
  const pushIds = withEmail.map((r) => r.user_id).filter((id): id is string => Boolean(id));
  if (pushIds.length > 0) {
    try {
      const { sendProjectNotification } = await import("./push");
      await sendProjectNotification({
        profileIds: pushIds,
        title: opts.isReminder
          ? `🔔 Rappel : ${ctx.commission.nom}`
          : `📣 Convocation : ${ctx.commission.nom}`,
        body: `${dateLabel}${ctx.lieu ? ` — ${ctx.lieu}` : ""}`,
        url: `/admin/commissions/${ctx.commission.id}/sessions/${sessionId}`,
        tag: `commission-session-${sessionId}`,
        category: "commission",
      });
    } catch (e) {
      console.error("[push] convocation:", e);
    }
  }

  return result;
}

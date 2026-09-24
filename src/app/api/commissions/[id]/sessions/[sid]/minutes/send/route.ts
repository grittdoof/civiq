import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { getBaseUrl } from "@/lib/base-url";
import { sendEmail } from "@/lib/email";
import { buildMinutesEmail } from "@/lib/emails/commission-minutes";
import { buildMinutesPdf } from "@/lib/projects/minutes-pdf";
import { formatSessionDate } from "@/lib/projects/convocation";
import { listConvocationRecipients, loadSessionContext } from "@/lib/projects/convocation-send";

// ═══════════════════════════════════════════════════════════════
// GET  /api/commissions/:id/sessions/:sid/minutes/send
//   → membres (email résolu) + dernier envoi du compte rendu à chacun
// POST /api/commissions/:id/sessions/:sid/minutes/send
//   body : { member_ids: string[], message?: string }
//   → envoie le PDF du compte rendu VALIDÉ aux membres choisis.
//     Répétable (renvoi, nouveaux destinataires). Historisé dans
//     session_minutes_sends.
//
// Autorisés : admin, éditeur, super-admin, secrétaire de séance.
// Un email par destinataire (pièce jointe → pas d'API batch Resend),
// espacés pour rester sous la limite de débit (2 req/s).
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_RECIPIENTS = 60;
const SEND_SPACING_MS = 550;

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

async function guardSend(id: string, sid: string) {
  const guard = await requireModule("projects");
  if (!guard.ok) return { error: guard.response } as const;
  if (!guard.communeId) {
    return { error: NextResponse.json({ error: "Aucune commune" }, { status: 403 }) } as const;
  }
  const service = await createServiceClient();
  const { data } = await service
    .from("commission_sessions")
    .select("id, commission_id, secretaire_de_seance_user_id, compte_rendu_valide, commission:commissions ( commune_id )")
    .eq("id", sid)
    .maybeSingle();
  const sess = data as unknown as {
    commission_id: string;
    secretaire_de_seance_user_id: string | null;
    compte_rendu_valide: boolean;
    commission: { commune_id: string } | null;
  } | null;
  if (!sess || sess.commission_id !== id || sess.commission?.commune_id !== guard.communeId) {
    return { error: NextResponse.json({ error: "Séance introuvable" }, { status: 404 }) } as const;
  }
  const allowed =
    ["admin", "editor", "super_admin"].includes(guard.role) ||
    sess.secretaire_de_seance_user_id === guard.userId;
  if (!allowed) {
    return { error: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }) } as const;
  }
  return { guard, service, validated: sess.compte_rendu_valide } as const;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await guardSend(id, sid);
  if ("error" in g) return g.error;

  const [recipients, { data: sends }] = await Promise.all([
    listConvocationRecipients(g.service, id),
    g.service
      .from("session_minutes_sends")
      .select("commission_member_id, email, ok, sent_at")
      .eq("session_id", sid)
      .order("sent_at", { ascending: false }),
  ]);
  const last = new Map<string, { ok: boolean; sent_at: string }>();
  for (const s of (sends ?? []) as { commission_member_id: string | null; ok: boolean; sent_at: string }[]) {
    if (s.commission_member_id && !last.has(s.commission_member_id)) {
      last.set(s.commission_member_id, { ok: s.ok, sent_at: s.sent_at });
    }
  }
  return NextResponse.json({
    recipients: recipients.map((r) => ({
      member_id: r.member_id,
      name: r.name,
      email: r.email,
      isExternal: r.isExternal,
      last_sent: last.get(r.member_id) ?? null,
    })),
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await guardSend(id, sid);
  if ("error" in g) return g.error;
  if (!g.validated) {
    return NextResponse.json({ error: "Validez le compte rendu avant de l'envoyer." }, { status: 409 });
  }

  let body: { member_ids?: string[]; message?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const wanted = new Set(Array.isArray(body.member_ids) ? body.member_ids : []);
  if (wanted.size === 0) {
    return NextResponse.json({ error: "Choisissez au moins un destinataire." }, { status: 400 });
  }
  if (wanted.size > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `${MAX_RECIPIENTS} destinataires maximum par envoi.` }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({ error: "L'envoi d'emails n'est pas configuré sur la plateforme." }, { status: 503 });
  }

  const [pdf, ctx, recipients, { data: sender }] = await Promise.all([
    buildMinutesPdf(g.guard.communeId, sid),
    loadSessionContext(g.service, sid),
    listConvocationRecipients(g.service, id),
    g.service.from("profiles").select("full_name").eq("id", g.guard.userId).maybeSingle(),
  ]);
  if (!pdf.ok) return NextResponse.json({ error: pdf.error }, { status: pdf.status });
  if (!ctx?.commission) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });

  const commune = ctx.commission.commune ?? { name: "votre commune" };
  const targets = recipients.filter((r) => wanted.has(r.member_id));
  const result = {
    sent: [] as { name: string; email: string }[],
    failed: [] as { name: string; email: string }[],
    skipped: [] as { name: string; reason: "no_email" }[],
  };
  const log: Record<string, unknown>[] = [];
  const base = getBaseUrl();
  const dateLabel = formatSessionDate(ctx.date_seance);

  for (const [i, r] of targets.entries()) {
    if (!r.email) {
      result.skipped.push({ name: r.name, reason: "no_email" });
      continue;
    }
    if (i > 0) await new Promise((res) => setTimeout(res, SEND_SPACING_MS));
    const built = buildMinutesEmail({
      siteUrl: base,
      commune,
      commissionName: ctx.commission.nom,
      recipientName: r.name,
      dateLabel,
      lieu: ctx.lieu,
      message: body.message?.slice(0, 2000) ?? null,
      senderName: sender?.full_name ?? null,
      pdfFilename: pdf.filename,
    });
    const { sent, error } = await sendEmail({
      to: r.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: commune.contact_email ?? undefined,
      attachments: [{ filename: pdf.filename, content: pdf.buffer }],
    });
    (sent ? result.sent : result.failed).push({ name: r.name, email: r.email });
    log.push({
      session_id: sid,
      commission_member_id: r.member_id,
      recipient_name: r.name,
      email: r.email,
      ok: sent,
      error: sent ? null : error ?? "send_failed",
      sent_by: g.guard.userId,
    });
  }

  if (log.length > 0) {
    const { error } = await g.service.from("session_minutes_sends").insert(log);
    if (error) console.error("[minutes] historique:", error);
  }

  await writeAudit({
    action: "commission.minutes.sent",
    targetType: "commission",
    targetId: id,
    communeId: g.guard.communeId,
    metadata: { session_id: sid, sent: result.sent.length, failed: result.failed.length },
  });

  return NextResponse.json({ result });
}

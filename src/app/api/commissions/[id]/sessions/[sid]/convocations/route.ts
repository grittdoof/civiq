import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { listConvocationRecipients, sendSessionConvocations } from "@/lib/projects/convocation-send";

// GET  /api/commissions/:id/sessions/:sid/convocations
//   → destinataires (email résolu) + statut d'envoi / de réponse
// POST /api/commissions/:id/sessions/:sid/convocations
//   body : { member_ids?: string[], reminder?: boolean }
//   → envoie (ou renvoie) la convocation ; renvoie le rapport d'envoi

export const maxDuration = 60;

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

async function guardSession(id: string, sid: string) {
  const guard = await requireModule("projects");
  if (!guard.ok) return { error: guard.response } as const;
  if (!guard.communeId) {
    return { error: NextResponse.json({ error: "Aucune commune" }, { status: 403 }) } as const;
  }
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return { error: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }) } as const;
  }
  const service = await createServiceClient();
  const { data: session } = await service
    .from("commission_sessions")
    .select("id, commission_id, commission:commissions ( commune_id )")
    .eq("id", sid)
    .maybeSingle();
  const communeId = (session as unknown as { commission: { commune_id: string } | null } | null)
    ?.commission?.commune_id;
  if (!session || session.commission_id !== id || communeId !== guard.communeId) {
    return { error: NextResponse.json({ error: "Séance introuvable" }, { status: 404 }) } as const;
  }
  return { guard, service } as const;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await guardSession(id, sid);
  if ("error" in g) return g.error;
  const recipients = await listConvocationRecipients(g.service, id, sid);
  return NextResponse.json({ recipients });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await guardSession(id, sid);
  if ("error" in g) return g.error;

  let body: { member_ids?: string[]; reminder?: boolean } = {};
  try { body = await req.json(); } catch { /* corps vide = tous les membres */ }

  try {
    const result = await sendSessionConvocations({
      service: g.service,
      sessionId: sid,
      memberIds: Array.isArray(body.member_ids) ? body.member_ids : null,
      isReminder: Boolean(body.reminder),
    });
    if (!result) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });

    await writeAudit({
      action: "commission.convocation.sent",
      targetType: "commission",
      targetId: id,
      communeId: g.guard.communeId,
      metadata: {
        session_id: sid,
        sent: result.sent.length,
        failed: result.failed.length,
        skipped: result.skipped.length,
        reminder: Boolean(body.reminder),
      },
    });
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[convocation] envoi:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur d'envoi" },
      { status: 500 },
    );
  }
}

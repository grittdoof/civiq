import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// POST /api/commissions/:id/sessions/:sid/attendance
// Body :
//   - { user_id, present, signature_data? }  → membre interne
//   - { commission_member_id, present, signature_data? } → membre externe
//
// Pour un interne : isSelf || isAdmin.
// Pour un externe : isAdmin uniquement (recueille la signature en séance).

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface Body {
  user_id?: string;
  commission_member_id?: string;
  present?: boolean;
  signature_data?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });

  const { sid } = await params;
  let body: Body = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (!body.user_id && !body.commission_member_id) {
    return NextResponse.json({ error: "user_id ou commission_member_id requis" }, { status: 400 });
  }

  const isAdmin = ["admin", "super_admin"].includes(guard.role);

  // Si interne : seul soi-même ou admin
  if (body.user_id) {
    const isSelf = body.user_id === guard.userId;
    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { error: "Vous ne pouvez signer que pour vous-même" },
        { status: 403 },
      );
    }
  } else {
    // Externe : admin only
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Seul un administrateur peut émarger un membre externe" },
        { status: 403 },
      );
    }
  }

  const service = await createServiceClient();
  const payload: Record<string, unknown> = {
    session_id: sid,
    conseiller_user_id: body.user_id ?? null,
    commission_member_id: body.commission_member_id ?? null,
    present: typeof body.present === "boolean" ? body.present : null,
    signature_data: body.signature_data ?? null,
    signe_le: body.signature_data ? new Date().toISOString() : null,
  };

  // Upsert sur clé adaptée : (session, user) pour interne ; (session, member) pour externe
  const onConflict = body.user_id
    ? "session_id,conseiller_user_id"
    : "session_id,commission_member_id";

  const { data, error } = await service
    .from("session_attendance")
    .upsert(payload, { onConflict })
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: body.signature_data ? "commission.attendance.signed" : "commission.attendance.marked",
    targetType: "commission",
    targetId: sid,
    communeId: guard.communeId,
    metadata: {
      user_id: body.user_id ?? null,
      commission_member_id: body.commission_member_id ?? null,
      present: body.present,
      signed_by: guard.userId,
    },
  });

  return NextResponse.json({ attendance: data });
}

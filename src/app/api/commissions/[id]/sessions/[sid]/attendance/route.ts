import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// POST /api/commissions/:id/sessions/:sid/attendance
// Body : { user_id, present, signature_data?: string }
//
// L'utilisateur signe pour lui-même (signature electronique) ; un
// admin peut signer pour un autre user. Upsert sur (session, user).

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface Body {
  user_id?: string;
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
  if (!body.user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const isAdmin = ["admin", "super_admin"].includes(guard.role);
  const isSelf = body.user_id === guard.userId;
  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: "Vous ne pouvez signer que pour vous-même" },
      { status: 403 },
    );
  }

  const service = await createServiceClient();
  const payload = {
    session_id: sid,
    conseiller_user_id: body.user_id,
    present: typeof body.present === "boolean" ? body.present : null,
    signature_data: body.signature_data ?? null,
    signe_le: body.signature_data ? new Date().toISOString() : null,
  };

  const { data, error } = await service
    .from("session_attendance")
    .upsert(payload, { onConflict: "session_id,conseiller_user_id" })
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: body.signature_data ? "commission.attendance.signed" : "commission.attendance.marked",
    targetType: "commission",
    targetId: sid,
    communeId: guard.communeId,
    metadata: { user_id: body.user_id, present: body.present, signed_by: guard.userId },
  });

  return NextResponse.json({ attendance: data });
}

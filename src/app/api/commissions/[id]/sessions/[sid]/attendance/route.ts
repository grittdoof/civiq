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

  // La séance doit appartenir à la commune de l'appelant
  const { data: sess } = await service
    .from("commission_sessions")
    .select("id, commission:commissions ( commune_id )")
    .eq("id", sid)
    .maybeSingle();
  const sessCommune = (sess as unknown as { commission: { commune_id: string } | null } | null)
    ?.commission?.commune_id;
  if (!sess || (sessCommune !== guard.communeId && guard.role !== "super_admin")) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const payload: Record<string, unknown> = {
    session_id: sid,
    conseiller_user_id: body.user_id ?? null,
    commission_member_id: body.commission_member_id ?? null,
    present: typeof body.present === "boolean" ? body.present : null,
    signature_data: body.signature_data ?? null,
    signe_le: body.signature_data ? new Date().toISOString() : null,
  };

  // Upsert « manuel » (select puis update/insert) plutôt que
  // `.upsert({ onConflict })` : pour les externes, l'unicité
  // (session_id, commission_member_id) était un index PARTIEL que
  // Postgres ne sait pas cibler en ON CONFLICT → 500 systématique.
  // (La migration 034 le remplace par une contrainte pleine ; ce code
  // reste correct avant comme après.)
  const keyCol = body.user_id ? "conseiller_user_id" : "commission_member_id";
  const keyVal = body.user_id ?? body.commission_member_id!;
  const { data: existing, error: selErr } = await service
    .from("session_attendance")
    .select("id")
    .eq("session_id", sid)
    .eq(keyCol, keyVal)
    .limit(1)
    .maybeSingle();
  if (selErr) {
    console.error("[attendance] select:", selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  // En mise à jour, on ne touche qu'aux champs fournis : marquer la
  // présence ne doit pas effacer une signature déjà recueillie.
  const patch: Record<string, unknown> = {};
  if (typeof body.present === "boolean") patch.present = body.present;
  if (body.signature_data !== undefined) {
    patch.signature_data = body.signature_data;
    patch.signe_le = body.signature_data ? new Date().toISOString() : null;
  }

  const { data, error } = existing
    ? await service.from("session_attendance").update(patch).eq("id", existing.id).select("*").maybeSingle()
    : await service.from("session_attendance").insert(payload).select("*").maybeSingle();
  if (error) {
    console.error("[attendance] write:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

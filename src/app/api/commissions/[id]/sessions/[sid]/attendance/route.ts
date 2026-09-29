import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// POST /api/commissions/:id/sessions/:sid/attendance
// Body :
//   - { user_id, statut?, signature_data? }  → membre interne
//   - { commission_member_id, statut?, signature_data? } → membre externe
//   (statut : present | excuse | absent | null ; `present` reste accepté)
//
// Pointer présent / excusé / absent : gestionnaires de la séance (admin,
// éditeur, super-admin, secrétaire de séance) ; un élu pour lui-même.
// Signature : un élu signe pour lui-même ; celle d'un membre externe est
// recueillie en séance par un gestionnaire.

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface Body {
  user_id?: string;
  commission_member_id?: string;
  present?: boolean;
  statut?: "present" | "excuse" | "absent" | null;
  signature_data?: string | null;
}

const STATUTS = ["present", "excuse", "absent"];

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

  if (body.statut !== undefined && body.statut !== null && !STATUTS.includes(body.statut)) {
    return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
  }

  const service = await createServiceClient();

  // La séance doit appartenir à la commune de l'appelant
  const { data: sess } = await service
    .from("commission_sessions")
    .select("id, secretaire_de_seance_user_id, commission:commissions ( commune_id )")
    .is("deleted_at", null)
    .eq("id", sid)
    .maybeSingle();
  const sessCommune = (sess as unknown as { commission: { commune_id: string } | null } | null)
    ?.commission?.commune_id;
  if (!sess || (sessCommune !== guard.communeId && guard.role !== "super_admin")) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const secretaireId = (sess as { secretaire_de_seance_user_id?: string | null }).secretaire_de_seance_user_id ?? null;
  const gestionnaire = ["admin", "editor", "super_admin"].includes(guard.role) || secretaireId === guard.userId;
  const isSelf = !!body.user_id && body.user_id === guard.userId;
  const signe = body.signature_data !== undefined && body.signature_data !== null;
  if (body.user_id) {
    // La signature d'un élu est personnelle ; le pointage, non.
    if (signe && !isSelf) return NextResponse.json({ error: "Chacun signe pour lui-même" }, { status: 403 });
    if (!isSelf && !gestionnaire) return NextResponse.json({ error: "Vous ne pouvez pointer que votre propre présence" }, { status: 403 });
  } else if (!gestionnaire) {
    return NextResponse.json({ error: "Seul un gestionnaire de la séance peut émarger un membre externe" }, { status: 403 });
  }

  const payload: Record<string, unknown> = {
    session_id: sid,
    conseiller_user_id: body.user_id ?? null,
    commission_member_id: body.commission_member_id ?? null,
    present: typeof body.present === "boolean" ? body.present : null,
    ...(body.statut !== undefined ? { statut: body.statut } : {}),
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
  if (body.statut !== undefined) patch.statut = body.statut;
  else if (typeof body.present === "boolean") patch.present = body.present;
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

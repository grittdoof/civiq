import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// PATCH /api/commissions/:id/sessions/:sid/minutes
// Body : { compte_rendu?: string, validate?: boolean }
//
// Seul le secrétaire de séance ou un admin peut modifier.
// Une fois validé : le CR devient verrouillé. Une notif est
// envoyée aux membres de la commission.

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface Body { compte_rendu?: string; validate?: boolean; }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });

  const { id: commissionId, sid } = await params;
  let body: Body = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const service = await createServiceClient();
  const { data: session } = await service
    .from("commission_sessions")
    .select("id, commission_id, secretaire_de_seance_user_id, compte_rendu_valide, commission:commissions ( commune_id, nom )")
    .eq("id", sid)
    .maybeSingle();
  type SessRow = {
    id: string;
    commission_id: string;
    secretaire_de_seance_user_id: string | null;
    compte_rendu_valide: boolean;
    commission: { commune_id: string; nom: string } | null;
  };
  const sess = session as SessRow | null;
  if (!sess || sess.commission?.commune_id !== guard.communeId) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }
  const isAdmin = ["admin", "super_admin"].includes(guard.role);
  const isSecretaire = sess.secretaire_de_seance_user_id === guard.userId;
  if (!isAdmin && !isSecretaire) {
    return NextResponse.json({ error: "Seul le secrétaire de séance ou un admin peut modifier le compte rendu" }, { status: 403 });
  }
  if (sess.compte_rendu_valide && !isAdmin) {
    return NextResponse.json({ error: "Le compte rendu est verrouillé (validé)" }, { status: 409 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.compte_rendu === "string") {
    updates.compte_rendu = body.compte_rendu.trim() || null;
  }
  if (body.validate) {
    updates.compte_rendu_valide = true;
    updates.compte_rendu_valide_at = new Date().toISOString();
    updates.compte_rendu_valide_by = guard.userId;
    updates.statut = "tenue";
  }

  const { data, error } = await service
    .from("commission_sessions")
    .update(updates)
    .eq("id", sid)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.validate) {
    await writeAudit({
      action: "commission.minutes.validated",
      targetType: "commission",
      targetId: commissionId,
      communeId: guard.communeId,
      metadata: { session_id: sid },
    });
    // Notif aux membres
    const { data: members } = await service
      .from("commission_members")
      .select("user_id")
      .eq("commission_id", commissionId);
    const ids = (members ?? []).map((m) => m.user_id as string);
    import("@/lib/projects/push")
      .then(({ notifyCommissionMinutesValidated }) =>
        notifyCommissionMinutesValidated({
          sessionId: sid,
          commissionName: sess.commission?.nom ?? "Commission",
          memberUserIds: ids,
        }),
      )
      .catch((e) => console.error("[push] minutes:", e));
  }

  return NextResponse.json({ session: data });
}

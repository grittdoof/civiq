import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// POST /api/commissions/:id/sessions
// Crée une séance + envoie la convocation push aux membres.

interface RouteParams { params: Promise<{ id: string }>; }

interface CreateBody {
  date_seance?: string;
  lieu?: string | null;
  ordre_du_jour?: string | null;
  secretaire_de_seance_user_id?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { id } = await params;
  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.date_seance) return NextResponse.json({ error: "date_seance requise" }, { status: 400 });

  const service = await createServiceClient();
  // Vérif ownership commission
  const { data: commission } = await service
    .from("commissions")
    .select("id, nom, commune_id")
    .eq("id", id)
    .maybeSingle();
  if (!commission || commission.commune_id !== guard.communeId) {
    return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });
  }

  const { data: session, error } = await service
    .from("commission_sessions")
    .insert({
      commission_id: id,
      date_seance: body.date_seance,
      lieu: body.lieu?.trim() || null,
      ordre_du_jour: body.ordre_du_jour?.trim() || null,
      secretaire_de_seance_user_id: body.secretaire_de_seance_user_id || null,
    })
    .select("*")
    .single();
  if (error || !session) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });

  // Notif convocation
  const { data: members } = await service
    .from("commission_members")
    .select("user_id")
    .eq("commission_id", id);
  const memberIds = (members ?? []).map((m) => m.user_id as string);

  import("@/lib/projects/push")
    .then(({ notifyCommissionConvocation }) =>
      notifyCommissionConvocation({
        sessionId: session.id,
        commissionName: commission.nom,
        dateSeance: session.date_seance,
        lieu: session.lieu,
        ordreDuJour: session.ordre_du_jour,
        memberUserIds: memberIds,
        isReminder: false,
      }),
    )
    .catch((e) => console.error("[push] convocation:", e));

  await writeAudit({
    action: "commission.session.created",
    targetType: "commission",
    targetId: id,
    communeId: guard.communeId,
    metadata: { session_id: session.id, date: body.date_seance },
  });

  return NextResponse.json({ session });
}

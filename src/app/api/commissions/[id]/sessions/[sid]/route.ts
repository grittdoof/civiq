import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { CommissionSessionStatut } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface PatchBody {
  date_seance?: string;
  lieu?: string | null;
  ordre_du_jour?: string | null;
  statut?: CommissionSessionStatut;
  secretaire_de_seance_user_id?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { sid } = await params;
  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if ("date_seance" in body) updates.date_seance = body.date_seance;
  if ("lieu" in body) updates.lieu = body.lieu?.trim() || null;
  if ("ordre_du_jour" in body) updates.ordre_du_jour = body.ordre_du_jour?.trim() || null;
  if ("statut" in body) updates.statut = body.statut;
  if ("secretaire_de_seance_user_id" in body) updates.secretaire_de_seance_user_id = body.secretaire_de_seance_user_id || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("commission_sessions")
    .update(updates)
    .eq("id", sid)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  return NextResponse.json({ session: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const { sid } = await params;

  const service = await createServiceClient();
  // Vérifier l'état du CR : si validé, seul un super_admin peut supprimer
  const { data: session } = await service
    .from("commission_sessions")
    .select("compte_rendu_valide")
    .eq("id", sid)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });

  const isSuperAdmin = guard.role === "super_admin";
  const isAdmin = guard.role === "admin";

  if (session.compte_rendu_valide) {
    // CR validé/verrouillé : super_admin uniquement
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Le compte rendu de cette séance est validé. Seul un super-administrateur peut la supprimer." },
        { status: 403 },
      );
    }
  } else {
    // CR non validé : admin commune ou super_admin
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
    }
  }

  const { error } = await service.from("commission_sessions").delete().eq("id", sid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

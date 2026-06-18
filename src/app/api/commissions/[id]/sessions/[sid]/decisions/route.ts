import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { SessionDecisionType } from "@/lib/projects/types";

// POST /api/commissions/:id/sessions/:sid/decisions
// Body : { libelle, type, project_id?, responsable_user_id?, echeance? }
//
// Si type='action' et project_id renseigné, le trigger SQL crée
// automatiquement un jalon sur le projet.

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

interface Body {
  libelle?: string;
  type?: SessionDecisionType;
  project_id?: string | null;
  responsable_user_id?: string | null;
  echeance?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { sid } = await params;
  let body: Body = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const libelle = body.libelle?.trim();
  if (!libelle) return NextResponse.json({ error: "libelle requis" }, { status: 400 });
  if (!body.type) return NextResponse.json({ error: "type requis" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("session_decisions")
    .insert({
      session_id: sid,
      project_id: body.project_id || null,
      libelle,
      type: body.type,
      responsable_user_id: body.responsable_user_id || null,
      echeance: body.echeance || null,
    })
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  return NextResponse.json({ decision: data });
}

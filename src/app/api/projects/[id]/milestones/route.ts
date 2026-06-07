import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { ProjectPhase } from "@/lib/projects/types";

// GET  /api/projects/:id/milestones
// POST /api/projects/:id/milestones

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("milestones")
    .select("*")
    .eq("project_id", id)
    .order("phase")
    .order("echeance", { nullsFirst: false });
  return NextResponse.json({ milestones: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase;
  libelle?: string;
  echeance?: string | null;
  responsable_user_id?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const libelle = body.libelle?.trim();
  if (!libelle) return NextResponse.json({ error: "Le libellé est obligatoire" }, { status: 400 });
  if (!body.phase) return NextResponse.json({ error: "La phase est obligatoire" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("milestones")
    .insert({
      project_id: id,
      phase: body.phase,
      libelle,
      echeance: body.echeance || null,
      responsable_user_id: body.responsable_user_id || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.milestone.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { milestone_id: data.id, phase: body.phase },
  });
  return NextResponse.json({ milestone: data });
}

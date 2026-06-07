import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { ProjectPhase, StakeholderRole } from "@/lib/projects/types";

// GET  /api/projects/:id/stakeholders  — liste enrichie (RACI)
// POST /api/projects/:id/stakeholders  — associe un stakeholder existant
//                                         au projet avec un rôle + phase

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_stakeholders")
    .select("*, stakeholder:stakeholders ( * )")
    .eq("project_id", id);
  return NextResponse.json({ stakeholders: data ?? [] });
}

interface CreateBody {
  stakeholder_id?: string;
  role?: StakeholderRole;
  phase?: ProjectPhase | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (!body.stakeholder_id) return NextResponse.json({ error: "stakeholder_id requis" }, { status: 400 });
  if (!body.role) return NextResponse.json({ error: "role requis" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_stakeholders")
    .insert({
      project_id: id,
      stakeholder_id: body.stakeholder_id,
      role: body.role,
      phase: body.phase ?? null,
    })
    .select("*, stakeholder:stakeholders ( * )")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "project.stakeholder.added",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { stakeholder_id: body.stakeholder_id, role: body.role, phase: body.phase ?? null },
  });
  return NextResponse.json({ project_stakeholder: data });
}

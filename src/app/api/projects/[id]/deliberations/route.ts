import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { ProjectPhase } from "@/lib/projects/types";

// GET  /api/projects/:id/deliberations
// POST /api/projects/:id/deliberations

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_deliberations")
    .select("*")
    .eq("project_id", id)
    .order("date_seance", { ascending: false });
  return NextResponse.json({ deliberations: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase;
  date_seance?: string;
  numero?: string | null;
  objet?: string;
  lien_pv?: string | null;
  document_id?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const objet = body.objet?.trim();
  if (!objet) return NextResponse.json({ error: "Objet requis" }, { status: 400 });
  if (!body.phase) return NextResponse.json({ error: "Phase requise" }, { status: 400 });
  if (!body.date_seance) return NextResponse.json({ error: "Date de séance requise" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_deliberations")
    .insert({
      project_id: id,
      phase: body.phase,
      date_seance: body.date_seance,
      numero: body.numero?.trim() || null,
      objet,
      lien_pv: body.lien_pv?.trim() || null,
      document_id: body.document_id || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.deliberation.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { deliberation_id: data.id, phase: body.phase },
  });
  return NextResponse.json({ deliberation: data });
}

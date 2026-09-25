import { NextRequest, NextResponse } from "next/server";
import { projectBelongsToCommune, requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string }>; }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const body = (await req.json()) as { project_id?: string };
  if (!body.project_id) return NextResponse.json({ error: "project_id requis" }, { status: 400 });
  // Le projet doit appartenir à la même commune que la commission
  if (!(await projectBelongsToCommune(body.project_id, access.communeId))) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  const service = await createServiceClient();
  const { error } = await service
    .from("commission_projects")
    .insert({ commission_id: id, project_id: body.project_id });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

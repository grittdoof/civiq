import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string }>; }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json()) as { project_id?: string };
  if (!body.project_id) return NextResponse.json({ error: "project_id requis" }, { status: 400 });
  const service = await createServiceClient();
  const { error } = await service
    .from("commission_projects")
    .insert({ commission_id: id, project_id: body.project_id });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

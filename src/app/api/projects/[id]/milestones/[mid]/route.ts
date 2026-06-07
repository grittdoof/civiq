import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

interface PatchBody {
  libelle?: string;
  echeance?: string | null;
  fait?: boolean;
  responsable_user_id?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (typeof body.libelle === "string") {
    const t = body.libelle.trim();
    if (!t) return NextResponse.json({ error: "Libellé vide" }, { status: 400 });
    updates.libelle = t;
  }
  if ("echeance" in body) updates.echeance = body.echeance || null;
  if (typeof body.fait === "boolean") updates.fait = body.fait;
  if ("responsable_user_id" in body) updates.responsable_user_id = body.responsable_user_id || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("milestones")
    .update(updates)
    .eq("id", mid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Jalon introuvable" }, { status: 404 });

  return NextResponse.json({ milestone: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("milestones")
    .delete()
    .eq("id", mid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

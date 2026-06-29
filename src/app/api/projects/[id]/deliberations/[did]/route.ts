import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; did: string }>; }

interface PatchBody {
  date_seance?: string;
  numero?: string | null;
  objet?: string;
  lien_pv?: string | null;
  document_id?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, did } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.date_seance) updates.date_seance = body.date_seance;
  if ("numero" in body) updates.numero = body.numero?.trim() || null;
  if (typeof body.objet === "string") {
    const t = body.objet.trim();
    if (!t) return NextResponse.json({ error: "Objet vide" }, { status: 400 });
    updates.objet = t;
  }
  if ("lien_pv" in body) updates.lien_pv = body.lien_pv?.trim() || null;
  if ("document_id" in body) updates.document_id = body.document_id || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_deliberations")
    .update(updates)
    .eq("id", did)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Délibération introuvable" }, { status: 404 });
  return NextResponse.json({ deliberation: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, did } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_deliberations")
    .delete()
    .eq("id", did)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

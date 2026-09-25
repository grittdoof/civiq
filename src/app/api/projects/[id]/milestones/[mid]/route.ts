import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { parseEtapeFields } from "@/lib/projects/etapes";
import { softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

// Accepte les champs d'étape (parseEtapeFields) et, pour l'ancienne
// interface, `fait` / `echeance` (synchronisés par trigger).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const parsed = parseEtapeFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updates: Record<string, unknown> = { ...parsed.fields };
  if (typeof body.fait === "boolean" && !("statut" in updates)) updates.fait = body.fait;
  if ("echeance" in body && !("date_previsionnelle" in updates)) {
    updates.echeance = typeof body.echeance === "string" && body.echeance ? body.echeance : null;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const service = await createServiceClient();
  if (typeof updates.responsable_user_id === "string") {
    const { data: prof } = await service
      .from("profiles").select("id").eq("id", updates.responsable_user_id).eq("commune_id", access.communeId).maybeSingle();
    if (!prof) return NextResponse.json({ error: "Responsable introuvable" }, { status: 404 });
  }

  const { data, error } = await service
    .from("milestones")
    .update(updates)
    .eq("id", mid)
    .eq("project_id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });

  return NextResponse.json({ milestone: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("milestones")
    .update(softDeleteFields(access.userId))
    .eq("id", mid)
    .eq("project_id", id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

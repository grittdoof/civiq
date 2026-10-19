import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { FK_VIOLATION, softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

const ROLES = ["president", "vice_president", "membre"];

// PATCH — rôle et/ou statut titulaire / suppléant d'un membre.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => ({}))) as { role?: unknown; statut_membre?: unknown };
  const updates: Record<string, unknown> = {};
  if (body.statut_membre === "titulaire" || body.statut_membre === "suppleant") updates.statut_membre = body.statut_membre;
  if (typeof body.role === "string" && ROLES.includes(body.role)) updates.role = body.role;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from("commission_members")
    .update(updates)
    .eq("id", mid)
    .eq("commission_id", id)
    .is("deleted_at", null)
    .select("id, role, statut_membre")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  return NextResponse.json({ member: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  // Édition membres : ouverte aux éditeurs (élus/agents) de la commune
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  // Un membre qui a déjà émargé ou été convoqué garde son historique :
  // suppression logique. Sinon (ajout par erreur), suppression réelle.
  const { error } = await service.from("commission_members").delete().eq("id", mid).eq("commission_id", id);
  if (error?.code === FK_VIOLATION) {
    const { error: softErr } = await service
      .from("commission_members")
      .update(softDeleteFields(access.userId))
      .eq("id", mid)
      .eq("commission_id", id);
    if (softErr) return NextResponse.json({ error: softErr.message }, { status: 500 });
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

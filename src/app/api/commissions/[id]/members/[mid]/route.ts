import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { FK_VIOLATION, softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

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

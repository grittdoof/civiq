import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  // Édition membres : ouverte aux éditeurs (élus/agents) de la commune
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service.from("commission_members").delete().eq("id", mid).eq("commission_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

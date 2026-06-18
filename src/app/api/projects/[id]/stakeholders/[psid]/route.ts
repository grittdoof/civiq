import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// DELETE /api/projects/:id/stakeholders/:psid — retire l'association

interface RouteParams { params: Promise<{ id: string; psid: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, psid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_stakeholders")
    .delete()
    .eq("id", psid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

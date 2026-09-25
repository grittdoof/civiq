import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; pid: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, pid } = await params;
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("commission_projects")
    .delete()
    .eq("commission_id", id)
    .eq("project_id", pid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; did: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, did } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const service = await createServiceClient();
  const { data: doc } = await service
    .from("project_documents")
    .select("storage_path")
    .eq("id", did)
    .eq("project_id", id)
    .maybeSingle();

  const { error } = await service
    .from("project_documents")
    .delete()
    .eq("id", did)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (doc?.storage_path) {
    await service.storage.from("project-documents").remove([doc.storage_path]);
  }

  return NextResponse.json({ ok: true });
}

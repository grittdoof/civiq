import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

interface RouteParams { params: Promise<{ id: string; sid: string; did: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { sid, did } = await params;
  const service = await createServiceClient();
  const { data: doc } = await service
    .from("session_documents")
    .select("storage_path")
    .eq("id", did)
    .eq("session_id", sid)
    .maybeSingle();

  const { error } = await service
    .from("session_documents")
    .delete()
    .eq("id", did)
    .eq("session_id", sid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (doc?.storage_path) {
    await service.storage.from("project-documents").remove([doc.storage_path]);
  }
  return NextResponse.json({ ok: true });
}

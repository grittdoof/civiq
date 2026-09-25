import { NextRequest, NextResponse } from "next/server";
import { requireSessionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; sid: string; did: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, sid, did } = await params;
  const access = await requireSessionEdit(id, sid);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("session_documents")
    .update(softDeleteFields(access.userId))
    .eq("id", did)
    .eq("session_id", sid)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fichier Storage conservé : archive publique (suppression logique uniquement).
  return NextResponse.json({ ok: true });
}

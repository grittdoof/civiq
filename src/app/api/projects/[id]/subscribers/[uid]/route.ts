import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// DELETE /api/projects/:id/subscribers/:uid
// L'utilisateur peut se désabonner de lui-même ;
// les éditeurs/admins peuvent désabonner quelqu'un d'autre.

interface RouteParams { params: Promise<{ id: string; uid: string }>; }

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, uid } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;

  const isSelf = access.userId === uid;
  const canEdit = ["admin", "editor", "super_admin"].includes(access.role);
  if (!isSelf && !canEdit) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("project_subscribers")
    .delete()
    .eq("project_id", id)
    .eq("user_id", uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

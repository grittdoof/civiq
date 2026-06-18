import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// POST   /api/projects/:id/photo  — upload photo de couverture
// DELETE /api/projects/:id/photo  — supprime la photo
//
// Bucket project-photos est public en lecture (pas de signed URL
// nécessaire). On stocke le chemin et l'URL publique générée.
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }>; }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo trop volumineuse (max 5 MB)" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté (JPG, PNG ou WebP)" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Récupère et supprime l'ancienne photo si elle existe
  const { data: previous } = await service
    .from("projects")
    .select("photo_storage_path")
    .eq("id", id)
    .maybeSingle();

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${access.communeId}/${id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await service.storage
    .from("project-photos")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: pub } = service.storage.from("project-photos").getPublicUrl(storagePath);
  const photoUrl = pub.publicUrl;

  const { error: updateErr } = await service
    .from("projects")
    .update({ photo_url: photoUrl, photo_storage_path: storagePath })
    .eq("id", id);
  if (updateErr) {
    await service.storage.from("project-photos").remove([storagePath]);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Cleanup de l'ancienne photo
  if (previous?.photo_storage_path) {
    await service.storage.from("project-photos").remove([previous.photo_storage_path]);
  }

  await writeAudit({
    action: "project.photo.uploaded",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
  });

  return NextResponse.json({ photo_url: photoUrl });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const service = await createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("photo_storage_path")
    .eq("id", id)
    .maybeSingle();

  await service
    .from("projects")
    .update({ photo_url: null, photo_storage_path: null })
    .eq("id", id);

  if (project?.photo_storage_path) {
    await service.storage.from("project-photos").remove([project.photo_storage_path]);
  }

  return NextResponse.json({ ok: true });
}

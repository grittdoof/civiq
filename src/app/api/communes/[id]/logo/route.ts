import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// POST   /api/communes/:id/logo — upload du logo de la commune
// DELETE /api/communes/:id/logo — retire le logo
//
// Autorisé : super-admin (toute commune) ou admin de SA commune.
// Bucket public `commune-logos` : le logo apparaît dans les emails
// (convocations), les sondages publics et les PDF.
// PNG / JPG / WebP uniquement — Gmail n'affiche pas le SVG.
// ═══════════════════════════════════════════════════════════════

const BUCKET = "commune-logos";
const MAX_BYTES = 2 * 1024 * 1024;
const MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface RouteParams { params: Promise<{ id: string }>; }

async function requireLogoEdit(id: string) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false as const, response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }
  const allowed = ctx.role === "super_admin" || (ctx.role === "admin" && ctx.communeId === id);
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }) };
  }
  const service = await createServiceClient();
  const { data: commune } = await service
    .from("communes")
    .select("id, logo_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!commune) {
    return { ok: false as const, response: NextResponse.json({ error: "Commune introuvable" }, { status: 404 }) };
  }
  return { ok: true as const, service, previousPath: commune.logo_storage_path as string | null };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireLogoEdit(id);
  if (!access.ok) return access.response;

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  const ext = MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Format non supporté (PNG, JPG ou WebP)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image trop volumineuse (max 2 Mo)" }, { status: 400 });
  }

  const { service, previousPath } = access;
  const storagePath = `${id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await service.storage
    .from(BUCKET)
    .upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: pub } = service.storage.from(BUCKET).getPublicUrl(storagePath);
  const { error: updateErr } = await service
    .from("communes")
    .update({ logo_url: pub.publicUrl, logo_storage_path: storagePath })
    .eq("id", id);
  if (updateErr) {
    await service.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  if (previousPath) await service.storage.from(BUCKET).remove([previousPath]);

  await writeAudit({ action: "commune.logo.uploaded", targetType: "commune", targetId: id, communeId: id });
  return NextResponse.json({ logo_url: pub.publicUrl });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireLogoEdit(id);
  if (!access.ok) return access.response;

  const { service, previousPath } = access;
  const { error } = await service
    .from("communes")
    .update({ logo_url: null, logo_storage_path: null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (previousPath) await service.storage.from(BUCKET).remove([previousPath]);

  await writeAudit({ action: "commune.logo.removed", targetType: "commune", targetId: id, communeId: id });
  return NextResponse.json({ ok: true });
}

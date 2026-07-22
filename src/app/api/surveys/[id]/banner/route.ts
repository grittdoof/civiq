import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { SurveySchema } from "@/types/survey";

// ═══════════════════════════════════════════════════════════════
// POST   /api/surveys/:id/banner  — upload du visuel bannière
// DELETE /api/surveys/:id/banner  — retire le visuel
//
// Le bucket survey-banners est public en lecture (le sondage l'est
// aussi). L'URL est persistée dans schema.settings.banner_url pour
// rester dans le modèle « tout le rendu vit dans le schema ».
// ═══════════════════════════════════════════════════════════════

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ["image/jpeg", "image/png", "image/webp"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Vérifie la session, le rôle et l'appartenance du sondage à la commune. */
async function requireSurveyEdit(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (
    !profile?.commune_id ||
    !["admin", "super_admin", "editor"].includes(profile.role)
  ) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 }),
    };
  }

  const { data: survey } = await service
    .from("surveys")
    .select("id, schema")
    .eq("id", id)
    .eq("commune_id", profile.commune_id)
    .maybeSingle();

  if (!survey) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sondage introuvable" }, { status: 404 }),
    };
  }

  return {
    ok: true as const,
    service,
    communeId: profile.commune_id as string,
    schema: (survey.schema || { steps: [], settings: {} }) as SurveySchema,
  };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireSurveyEdit(id);
  if (!access.ok) return access.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image trop volumineuse (max 5 Mo)" }, { status: 400 });
  }
  if (!MIME.includes(file.type)) {
    return NextResponse.json({ error: "Format non supporté (JPG, PNG ou WebP)" }, { status: 400 });
  }

  const { service, schema, communeId } = access;
  const previousPath = schema.settings?.banner_storage_path;

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const storagePath = `${communeId}/${id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await service.storage
    .from("survey-banners")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: pub } = service.storage.from("survey-banners").getPublicUrl(storagePath);
  const bannerUrl = pub.publicUrl;

  const nextSchema: SurveySchema = {
    ...schema,
    settings: {
      ...schema.settings,
      banner_url: bannerUrl,
      banner_storage_path: storagePath,
    },
  };

  const { error: updateErr } = await service
    .from("surveys")
    .update({ schema: nextSchema })
    .eq("id", id);
  if (updateErr) {
    await service.storage.from("survey-banners").remove([storagePath]);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (previousPath) {
    await service.storage.from("survey-banners").remove([previousPath]);
  }

  await writeAudit({
    action: "survey.banner.uploaded",
    targetType: "survey",
    targetId: id,
    communeId,
  });

  return NextResponse.json({ banner_url: bannerUrl, banner_storage_path: storagePath });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireSurveyEdit(id);
  if (!access.ok) return access.response;

  const { service, schema, communeId } = access;
  const previousPath = schema.settings?.banner_storage_path;

  const nextSettings = { ...schema.settings };
  delete nextSettings.banner_url;
  delete nextSettings.banner_storage_path;

  const { error } = await service
    .from("surveys")
    .update({ schema: { ...schema, settings: nextSettings } })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (previousPath) {
    await service.storage.from("survey-banners").remove([previousPath]);
  }

  await writeAudit({
    action: "survey.banner.removed",
    targetType: "survey",
    targetId: id,
    communeId,
  });

  return NextResponse.json({ ok: true });
}

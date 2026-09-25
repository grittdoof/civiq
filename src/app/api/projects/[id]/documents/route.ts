import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects/:id/documents  — liste des documents
// POST /api/projects/:id/documents  — upload multipart file
//
// Le fichier est stocké dans le bucket project-documents (privé)
// puis on enregistre une ligne project_documents avec une URL
// signée valable longtemps (générée à la demande à la lecture).
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }>; }

const ALLOWED_TYPES = new Set([
  "fiche_projet", "deliberation", "devis", "plan_financement", "autre",
]);

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_documents")
    .select("*")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("uploaded_at", { ascending: false });

  // Re-signer les URLs à chaque appel (signed URL bucket privé, 7 jours)
  const docs = await Promise.all(
    (data ?? []).map(async (d) => {
      if (d.storage_path) {
        const { data: signed } = await service.storage
          .from("project-documents")
          .createSignedUrl(d.storage_path, 60 * 60 * 24 * 7);
        return { ...d, url: signed?.signedUrl ?? d.url };
      }
      return d;
    }),
  );

  return NextResponse.json({ documents: docs });
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const form = await req.formData();
  const file = form.get("file");
  const nom = (form.get("nom") as string | null)?.trim() || (file instanceof File ? file.name : "");
  const type = (form.get("type") as string | null) ?? "autre";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 MB)" }, { status: 400 });
  }

  // Type réel déduit de l'extension (liste blanche), jamais du type
  // déclaré par le navigateur (audit §1.5, S8).
  const ext = (file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    return NextResponse.json(
      { error: "Format non accepté. Formats possibles : PDF, image (JPG, PNG, WebP), Word, Excel." },
      { status: 400 },
    );
  }

  const service = await createServiceClient();

  // Rattachement facultatif à une étape du même projet (lot B).
  const milestoneId = (form.get("milestone_id") as string | null) || null;
  if (milestoneId) {
    const { data: ms } = await service
      .from("milestones").select("id").eq("id", milestoneId).eq("project_id", id).is("deleted_at", null).maybeSingle();
    if (!ms) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
  }
  const noteInterne = form.get("note_interne") === "true";

  const storagePath = `${access.communeId}/${id}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await service.storage
    .from("project-documents")
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from("project-documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const { data: doc, error } = await service
    .from("project_documents")
    .insert({
      project_id: id,
      type,
      nom,
      url: signed?.signedUrl ?? "",
      storage_path: storagePath,
      uploaded_by: access.userId,
      milestone_id: milestoneId,
      note_interne: noteInterne,
    })
    .select("*")
    .single();

  if (error || !doc) {
    // Cleanup storage si insert raté
    await service.storage.from("project-documents").remove([storagePath]);
    return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  }

  await writeAudit({
    action: "project.document.uploaded",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { document_id: doc.id, nom, type },
  });

  return NextResponse.json({ document: doc });
}

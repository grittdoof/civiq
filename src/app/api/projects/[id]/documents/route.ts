import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import {
  MAX_DEPOT_OCTETS, extensionDe, lireDemandeDepot, preparerDepot, tropLourd, verifierDepot,
} from "@/lib/storage/depot-direct";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects/:id/documents  — liste des documents
// POST /api/projects/:id/documents  — dépôt direct en deux étapes
//      { etape: "preparer", nom, taille, type, milestone_id?, note_interne? }
//      puis { etape: "enregistrer", path, nom, type, milestone_id?, note_interne? }
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

const BUCKET = "project-documents";
const FORMAT_REFUSE = () => NextResponse.json(
  { error: "Format non accepté. Formats possibles : PDF, image (JPG, PNG, WebP), Word, Excel." },
  { status: 400 },
);

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  // Dépôt direct dans le stockage (lib/storage/depot-direct.ts) :
  // le fichier ne transite plus par Vercel (limite de 4,5 Mo).
  const body = await lireDemandeDepot(req);
  if (!body) return NextResponse.json({ error: "Requête de dépôt invalide." }, { status: 400 });

  const nom = (typeof body.nom === "string" ? body.nom : "").trim().slice(0, 200);
  const type = typeof body.type === "string" ? body.type : "autre";
  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!ALLOWED_TYPES.has(type)) return NextResponse.json({ error: "type invalide" }, { status: 400 });

  const service = await createServiceClient();

  // Rattachement facultatif à une étape du même projet (lot B).
  const milestoneId = typeof body.milestone_id === "string" && body.milestone_id ? body.milestone_id : null;
  if (milestoneId) {
    const { data: ms } = await service
      .from("milestones").select("id").eq("id", milestoneId).eq("project_id", id).is("deleted_at", null).maybeSingle();
    if (!ms) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
  }
  const prefixe = `${access.communeId}/${id}/`;

  if (body.etape === "preparer") {
    // Type réel déduit de l'extension (liste blanche), jamais du type
    // déclaré par le navigateur (audit §1.5, S8).
    const ext = extensionDe(nom);
    const contentType = MIME_BY_EXT[ext];
    if (!contentType) return FORMAT_REFUSE();
    if (Number(body.taille) > MAX_DEPOT_OCTETS) return tropLourd();
    return preparerDepot(service, BUCKET, `${prefixe}${crypto.randomUUID()}.${ext}`, contentType);
  }

  const depot = await verifierDepot(service, BUCKET, body.path, prefixe);
  if (!depot.ok) return depot.response;
  const storagePath = depot.path;
  if (!MIME_BY_EXT[extensionDe(storagePath)]) return FORMAT_REFUSE();
  const noteInterne = body.note_interne === true || body.note_interne === "true";

  const { data: signed } = await service.storage
    .from(BUCKET)
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
    // Fichier sans fiche : retiré du stockage.
    await service.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  }

  await writeAudit({
    action: "project.document.uploaded",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { document_id: doc.id, nom, type, taille: depot.taille },
  });

  return NextResponse.json({ document: doc });
}

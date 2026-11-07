import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import {
  MAX_DEPOT_OCTETS, extensionDe, lireDemandeDepot, preparerDepot, tropLourd, verifierDepot,
} from "@/lib/storage/depot-direct";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

const ALLOWED_TYPES = new Set([
  "ordre_du_jour", "presentation", "rapport", "annexe", "autre",
]);

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
const FORMAT_REFUSE = () => NextResponse.json(
  { error: "Format non accepté. Formats possibles : PDF, image (JPG, PNG, WebP), Word, Excel." },
  { status: 400 },
);

async function checkSessionAccess(sid: string, communeId: string) {
  const service = await createServiceClient();
  const { data } = await service
    .from("commission_sessions")
    .select("id, commission:commissions ( commune_id )")
    .is("deleted_at", null)
    .eq("id", sid)
    .maybeSingle();
  type Row = { id: string; commission: { commune_id: string } | null };
  const row = data as Row | null;
  return row?.commission?.commune_id === communeId;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const { sid } = await params;
  if (!(await checkSessionAccess(sid, guard.communeId))) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }
  const service = await createServiceClient();
  const { data } = await service
    .from("session_documents")
    .select("*")
    .is("deleted_at", null)
    .eq("session_id", sid)
    .order("uploaded_at", { ascending: false });

  // Re-signer les URLs
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

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { id: commissionId, sid } = await params;
  if (!(await checkSessionAccess(sid, guard.communeId))) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  // Dépôt direct dans le stockage (le fichier ne passe plus par Vercel).
  const body = await lireDemandeDepot(req);
  if (!body) return NextResponse.json({ error: "Requête de dépôt invalide." }, { status: 400 });
  const nom = (typeof body.nom === "string" ? body.nom : "").trim().slice(0, 200);
  const type = typeof body.type === "string" ? body.type : "annexe";
  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  }

  const service = await createServiceClient();
  const prefixe = `${guard.communeId}/sessions/${sid}/`;
  if (body.etape === "preparer") {
    const ext = extensionDe(nom);
    const contentType = MIME_BY_EXT[ext];
    if (!contentType) return FORMAT_REFUSE();
    if (Number(body.taille) > MAX_DEPOT_OCTETS) return tropLourd();
    return preparerDepot(service, "project-documents", `${prefixe}${crypto.randomUUID()}.${ext}`, contentType);
  }
  const depot = await verifierDepot(service, "project-documents", body.path, prefixe);
  if (!depot.ok) return depot.response;
  if (!MIME_BY_EXT[extensionDe(depot.path)] || depot.path.slice(prefixe.length).startsWith("emargement-")) return FORMAT_REFUSE();
  const storagePath = depot.path;

  const { data: signed } = await service.storage
    .from("project-documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const { data: doc, error } = await service
    .from("session_documents")
    .insert({
      session_id: sid,
      type,
      nom,
      url: signed?.signedUrl ?? "",
      storage_path: storagePath,
      uploaded_by: guard.userId,
    })
    .select("*")
    .single();

  if (error || !doc) {
    await service.storage.from("project-documents").remove([storagePath]);
    return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  }

  await writeAudit({
    action: "commission.session.document.uploaded",
    targetType: "commission",
    targetId: commissionId,
    communeId: guard.communeId,
    metadata: { session_id: sid, document_id: doc.id, nom, type },
  });

  return NextResponse.json({ document: doc });
}

import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

const ALLOWED_TYPES = new Set([
  "ordre_du_jour", "presentation", "rapport", "annexe", "autre",
]);

async function checkSessionAccess(sid: string, communeId: string) {
  const service = await createServiceClient();
  const { data } = await service
    .from("commission_sessions")
    .select("id, commission:commissions ( commune_id )")
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

  const form = await req.formData();
  const file = form.get("file");
  const nom = (form.get("nom") as string | null)?.trim() || (file instanceof File ? file.name : "");
  const type = (form.get("type") as string | null) ?? "annexe";

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

  const service = await createServiceClient();
  const ext = file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "bin";
  const storagePath = `${guard.communeId}/sessions/${sid}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await service.storage
    .from("project-documents")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

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

import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import {
  MAX_DEPOT_OCTETS, extensionDe, lireDemandeDepot, preparerDepot, tropLourd, verifierDepot,
} from "@/lib/storage/depot-direct";

// POST   /api/commissions/:id/sessions/:sid/signed-pdf  — dépôt direct du PDF
//        ({ etape: "preparer", nom, taille } puis { etape: "enregistrer", path })
// DELETE /api/commissions/:id/sessions/:sid/signed-pdf  — supprime

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

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
  const service = await createServiceClient();
  const prefixe = `${guard.communeId}/sessions/${sid}/`;
  if (body.etape === "preparer") {
    if (extensionDe(typeof body.nom === "string" ? body.nom : "") !== "pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
    }
    if (Number(body.taille) > MAX_DEPOT_OCTETS) return tropLourd();
    return preparerDepot(service, "project-documents", `${prefixe}emargement-${crypto.randomUUID()}.pdf`, "application/pdf");
  }
  const depot = await verifierDepot(service, "project-documents", body.path, prefixe);
  if (!depot.ok) return depot.response;
  if (!/^emargement-[0-9a-f-]+\.pdf$/.test(depot.path.slice(prefixe.length))) {
    return NextResponse.json({ error: "Dépôt invalide." }, { status: 400 });
  }
  const storagePath = depot.path;

  // Ancien fichier, retiré après remplacement
  const { data: prev } = await service
    .from("commission_sessions")
    .select("signed_attendance_pdf_path")
    .is("deleted_at", null)
    .eq("id", sid)
    .maybeSingle();

  const { data: signed } = await service.storage
    .from("project-documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const { error: updateErr } = await service
    .from("commission_sessions")
    .update({
      signed_attendance_pdf_url: signed?.signedUrl ?? "",
      signed_attendance_pdf_path: storagePath,
      signed_attendance_uploaded_by: guard.userId,
      signed_attendance_uploaded_at: new Date().toISOString(),
    })
    .eq("id", sid);
  if (updateErr) {
    await service.storage.from("project-documents").remove([storagePath]);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (prev?.signed_attendance_pdf_path) {
    await service.storage.from("project-documents").remove([prev.signed_attendance_pdf_path]);
  }

  await writeAudit({
    action: "commission.session.signed_attendance.uploaded",
    targetType: "commission",
    targetId: commissionId,
    communeId: guard.communeId,
    metadata: { session_id: sid },
  });

  return NextResponse.json({ signed_url: signed?.signedUrl ?? null });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const { sid } = await params;
  if (!(await checkSessionAccess(sid, guard.communeId))) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }
  const service = await createServiceClient();
  const { data: prev } = await service
    .from("commission_sessions")
    .select("signed_attendance_pdf_path")
    .is("deleted_at", null)
    .eq("id", sid)
    .maybeSingle();

  await service
    .from("commission_sessions")
    .update({
      signed_attendance_pdf_url: null,
      signed_attendance_pdf_path: null,
      signed_attendance_uploaded_by: null,
      signed_attendance_uploaded_at: null,
    })
    .eq("id", sid);

  if (prev?.signed_attendance_pdf_path) {
    await service.storage.from("project-documents").remove([prev.signed_attendance_pdf_path]);
  }

  return NextResponse.json({ ok: true });
}

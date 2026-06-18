import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// POST   /api/commissions/:id/sessions/:sid/signed-pdf  — upload PDF
// DELETE /api/commissions/:id/sessions/:sid/signed-pdf  — supprime

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 MB)" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Suppression de l'ancien fichier si présent
  const { data: prev } = await service
    .from("commission_sessions")
    .select("signed_attendance_pdf_path")
    .eq("id", sid)
    .maybeSingle();

  const storagePath = `${guard.communeId}/sessions/${sid}/emargement-${crypto.randomUUID()}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await service.storage
    .from("project-documents")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

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

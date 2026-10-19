import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// POST   /api/commissions/:id/sessions/:sid/minutes/fichier (multipart « file »)
// DELETE /api/commissions/:id/sessions/:sid/minutes/fichier
//
// Compte rendu déposé en fichier (PDF ou Word) au lieu d'être rédigé
// dans l'éditeur. Mêmes droits que la rédaction : secrétaire de séance
// ou administrateur ; verrouillé une fois validé (sauf administrateur).
// Bucket privé « project-documents » ; l'ancien fichier est conservé
// (aucune suppression physique), seul le lien change.
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";

interface RouteParams { params: Promise<{ id: string; sid: string }> }

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
};
const MAX_OCTETS = 20 * 1024 * 1024;

async function garde(commissionId: string, sid: string) {
  const guard = await requireModule("projects");
  if (!guard.ok) return { error: guard.response } as const;
  if (!guard.communeId) return { error: NextResponse.json({ error: "Aucune commune" }, { status: 403 }) } as const;
  const service = await createServiceClient();
  const { data: s } = await service
    .from("commission_sessions")
    .select("id, commission_id, secretaire_de_seance_user_id, compte_rendu_valide")
    .eq("id", sid)
    .is("deleted_at", null)
    .maybeSingle();
  if (!s || s.commission_id !== commissionId) return { error: NextResponse.json({ error: "Séance introuvable" }, { status: 404 }) } as const;
  const { data: c } = await service.from("commissions").select("commune_id").eq("id", commissionId).maybeSingle();
  if (!c || c.commune_id !== guard.communeId) return { error: NextResponse.json({ error: "Séance introuvable" }, { status: 404 }) } as const;
  const isAdmin = ["admin", "super_admin"].includes(guard.role);
  if (!isAdmin && s.secretaire_de_seance_user_id !== guard.userId) {
    return { error: NextResponse.json({ error: "Seul le secrétaire de séance ou un administrateur peut déposer le compte rendu." }, { status: 403 }) } as const;
  }
  if (s.compte_rendu_valide && !isAdmin) {
    return { error: NextResponse.json({ error: "Le compte rendu est verrouillé (validé)." }, { status: 409 }) } as const;
  }
  return { guard, service } as const;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await garde(id, sid);
  if ("error" in g) return g.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const type = TYPES[ext];
  if (!type) return NextResponse.json({ error: "Format accepté : PDF ou Word (.pdf, .doc, .docx, .odt)." }, { status: 400 });
  if (file.size > MAX_OCTETS) return NextResponse.json({ error: "Fichier trop volumineux (20 Mo au maximum)." }, { status: 413 });

  const nom = file.name.replace(/[\\/\r\n"]/g, "_").slice(0, 200);
  const path = `commissions/${id}/${sid}/compte-rendu-${Date.now()}.${ext}`;
  const { error: upErr } = await g.service.storage
    .from("project-documents")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false });
  if (upErr) {
    console.error("[minutes] dépôt:", upErr);
    return NextResponse.json({ error: "Le fichier n'a pas été enregistré." }, { status: 500 });
  }
  const now = new Date().toISOString();
  const { error } = await g.service.from("commission_sessions").update({
    cr_fichier_path: path, cr_fichier_nom: nom, cr_fichier_type: type, cr_fichier_par: g.guard.userId, cr_fichier_le: now,
  }).eq("id", sid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit({
    action: "commission.minutes.file_uploaded",
    targetType: "commission",
    targetId: id,
    communeId: g.guard.communeId,
    metadata: { session_id: sid, nom },
  });
  const { data: signed } = await g.service.storage.from("project-documents").createSignedUrl(path, 3600);
  return NextResponse.json({ fichier: { nom, type, le: now, url: signed?.signedUrl ?? null } });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, sid } = await params;
  const g = await garde(id, sid);
  if ("error" in g) return g.error;
  const { error } = await g.service.from("commission_sessions").update({
    cr_fichier_path: null, cr_fichier_nom: null, cr_fichier_type: null, cr_fichier_par: null, cr_fichier_le: null,
  }).eq("id", sid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

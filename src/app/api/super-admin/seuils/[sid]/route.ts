import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";

// PATCH /api/super-admin/seuils/:sid — date de fin, référence, commentaire.
// Le montant et la date d'effet ne se modifient pas : on crée une nouvelle
// version (un devis déjà évalué doit rester évalué avec la même valeur).

interface RouteParams { params: Promise<{ sid: string }>; }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const { sid } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = { updated_by: ctx!.userId };
  if ("date_fin" in body) {
    if (body.date_fin !== null && !(typeof body.date_fin === "string" && DATE_RE.test(body.date_fin))) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
    updates.date_fin = body.date_fin;
  }
  for (const k of ["reference", "commentaire"] as const) {
    if (k in body) updates[k] = typeof body[k] === "string" ? (body[k] as string).trim() || null : null;
  }
  const service = await createServiceClient();
  const { data, error } = await service.from("seuils_commande_publique").update(updates).eq("id", sid).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Seuil introuvable" }, { status: 404 });
  await writeAudit({ action: "platform.seuil.updated", targetType: "seuil", targetId: sid, metadata: { fields: Object.keys(updates) } });
  return NextResponse.json({ seuil: data });
}

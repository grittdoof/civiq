import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { AuthorizationStatus, AuthorizationType } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string; aid: string }>; }

const ALLOWED_TYPES = new Set<AuthorizationType>([
  "arrete_municipal", "declaration_prefecture", "sacem", "securite",
  "erp", "debit_boisson", "autre",
]);
const ALLOWED_STATUTS = new Set<AuthorizationStatus>([
  "a_obtenir", "depose", "obtenu", "refuse",
]);

interface PatchBody {
  type?: AuthorizationType;
  libelle?: string;
  statut?: AuthorizationStatus;
  echeance?: string | null;
  obtenu_le?: string | null;
  document_id?: string | null;
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, aid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.type) {
    if (!ALLOWED_TYPES.has(body.type)) return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    updates.type = body.type;
  }
  if (typeof body.libelle === "string") {
    const t = body.libelle.trim();
    if (!t) return NextResponse.json({ error: "Libellé vide" }, { status: 400 });
    updates.libelle = t;
  }
  if (body.statut) {
    if (!ALLOWED_STATUTS.has(body.statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    updates.statut = body.statut;
  }
  if ("echeance" in body) updates.echeance = body.echeance || null;
  if ("obtenu_le" in body) updates.obtenu_le = body.obtenu_le || null;
  if ("document_id" in body) updates.document_id = body.document_id || null;
  if ("notes" in body) updates.notes = body.notes?.trim() || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_authorizations")
    .update(updates)
    .eq("id", aid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Autorisation introuvable" }, { status: 404 });
  return NextResponse.json({ authorization: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, aid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_authorizations")
    .delete()
    .eq("id", aid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

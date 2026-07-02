import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { QuoteStatut } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string; qid: string }>; }

const ALLOWED_STATUTS = new Set<QuoteStatut>(["recu", "en_attente", "retenu", "non_retenu"]);

interface PatchBody {
  prestataire?: string;
  objet?: string | null;
  montant_ht?: number | null;
  montant_ttc?: number | null;
  delai_jours?: number | null;
  statut?: QuoteStatut;
  document_id?: string | null;
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, qid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (typeof body.prestataire === "string") {
    const t = body.prestataire.trim();
    if (!t) return NextResponse.json({ error: "Prestataire vide" }, { status: 400 });
    updates.prestataire = t;
  }
  if ("objet" in body) updates.objet = body.objet?.trim() || null;
  if ("montant_ht" in body) updates.montant_ht = body.montant_ht ?? null;
  if ("montant_ttc" in body) updates.montant_ttc = body.montant_ttc ?? null;
  if ("delai_jours" in body) updates.delai_jours = body.delai_jours ?? null;
  if (body.statut) {
    if (!ALLOWED_STATUTS.has(body.statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    updates.statut = body.statut;
  }
  if ("document_id" in body) updates.document_id = body.document_id || null;
  if ("notes" in body) updates.notes = body.notes?.trim() || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_quotes")
    .update(updates)
    .eq("id", qid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  return NextResponse.json({ quote: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, qid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_quotes")
    .delete()
    .eq("id", qid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

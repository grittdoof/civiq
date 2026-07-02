import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { ProjectPhase, QuoteStatut } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

const ALLOWED_STATUTS = new Set<QuoteStatut>(["recu", "en_attente", "retenu", "non_retenu"]);

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_quotes")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ quotes: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase;
  prestataire?: string;
  objet?: string | null;
  montant_ht?: number | null;
  montant_ttc?: number | null;
  delai_jours?: number | null;
  statut?: QuoteStatut;
  document_id?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const prestataire = body.prestataire?.trim();
  if (!prestataire) return NextResponse.json({ error: "Prestataire requis" }, { status: 400 });
  if (!body.phase) return NextResponse.json({ error: "Phase requise" }, { status: 400 });
  const statut = body.statut ?? "recu";
  if (!ALLOWED_STATUTS.has(statut)) return NextResponse.json({ error: "Statut invalide" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_quotes")
    .insert({
      project_id: id,
      phase: body.phase,
      prestataire,
      objet: body.objet?.trim() || null,
      montant_ht: body.montant_ht ?? null,
      montant_ttc: body.montant_ttc ?? null,
      delai_jours: body.delai_jours ?? null,
      statut,
      document_id: body.document_id || null,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.quote.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { quote_id: data.id, phase: body.phase },
  });
  return NextResponse.json({ quote: data });
}

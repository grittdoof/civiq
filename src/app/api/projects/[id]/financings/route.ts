import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { FinancingStatus } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects/:id/financings   — liste les subventions
// POST /api/projects/:id/financings   — ajoute une ligne
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("financings")
    .select("*")
    .eq("project_id", id)
    .order("created_at");
  return NextResponse.json({ financings: data ?? [] });
}

interface CreateBody {
  financeur?: string;
  dispositif?: string | null;
  montant_demande?: number | null;
  montant_obtenu?: number | null;
  statut?: FinancingStatus;
  date_demande?: string | null;
  date_ar?: string | null;
  date_decision?: string | null;
  definition_commencement?: string | null;
  date_notification_marche?: string | null;
  date_ordre_service?: string | null;
  eligibilite_note?: string | null;
  taux?: number | null;
  plafond?: number | null;
  deadline_depot?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const financeur = body.financeur?.trim();
  if (!financeur) return NextResponse.json({ error: "Le financeur est obligatoire" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("financings")
    .insert({
      project_id: id,
      financeur,
      dispositif: body.dispositif?.trim() || null,
      montant_demande: body.montant_demande ?? null,
      montant_obtenu: body.montant_obtenu ?? null,
      statut: body.statut ?? "a_demander",
      date_demande: body.date_demande || null,
      date_ar: body.date_ar || null,
      date_decision: body.date_decision || null,
      definition_commencement: body.definition_commencement?.trim() || null,
      date_notification_marche: body.date_notification_marche || null,
      date_ordre_service: body.date_ordre_service || null,
      eligibilite_note: body.eligibilite_note?.trim() || null,
      taux: body.taux ?? null,
      plafond: body.plafond ?? null,
      deadline_depot: body.deadline_depot || null,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });

  await writeAudit({
    action: "project.financing.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { financing_id: data.id, financeur, statut: data.statut },
  });

  return NextResponse.json({ financing: data });
}

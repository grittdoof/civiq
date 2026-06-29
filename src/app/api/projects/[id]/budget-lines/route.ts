import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import type { BudgetCategorie, BudgetSens, ProjectPhase } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

const ALLOWED_SENS = new Set<BudgetSens>(["depense", "recette"]);
const ALLOWED_CATEGORIES = new Set<BudgetCategorie>([
  "buvette", "billetterie", "mecenat", "subvention",
  "prestataire", "materiel", "location", "personnel",
  "communication", "autre",
]);

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_budget_lines")
    .select("*")
    .eq("project_id", id)
    .order("sens")
    .order("created_at", { ascending: true });
  return NextResponse.json({ budget_lines: data ?? [] });
}

interface CreateBody {
  phase?: ProjectPhase | null;
  sens?: BudgetSens;
  categorie?: BudgetCategorie | null;
  libelle?: string;
  montant_prevu?: number | null;
  montant_reel?: number | null;
  notes?: string | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const libelle = body.libelle?.trim();
  if (!libelle) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });
  if (!body.sens || !ALLOWED_SENS.has(body.sens)) return NextResponse.json({ error: "Sens invalide (depense/recette)" }, { status: 400 });
  if (body.categorie && !ALLOWED_CATEGORIES.has(body.categorie)) return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_budget_lines")
    .insert({
      project_id: id,
      phase: body.phase ?? null,
      sens: body.sens,
      categorie: body.categorie ?? null,
      libelle,
      montant_prevu: body.montant_prevu ?? null,
      montant_reel: body.montant_reel ?? null,
      notes: body.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.budget_line.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { budget_line_id: data.id, sens: body.sens },
  });
  return NextResponse.json({ budget_line: data });
}

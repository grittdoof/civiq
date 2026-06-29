import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { BudgetCategorie, BudgetSens } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string; bid: string }>; }

const ALLOWED_SENS = new Set<BudgetSens>(["depense", "recette"]);
const ALLOWED_CATEGORIES = new Set<BudgetCategorie>([
  "buvette", "billetterie", "mecenat", "subvention",
  "prestataire", "materiel", "location", "personnel",
  "communication", "autre",
]);

interface PatchBody {
  sens?: BudgetSens;
  categorie?: BudgetCategorie | null;
  libelle?: string;
  montant_prevu?: number | null;
  montant_reel?: number | null;
  notes?: string | null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, bid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PatchBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.sens) {
    if (!ALLOWED_SENS.has(body.sens)) return NextResponse.json({ error: "Sens invalide" }, { status: 400 });
    updates.sens = body.sens;
  }
  if ("categorie" in body) {
    if (body.categorie && !ALLOWED_CATEGORIES.has(body.categorie)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }
    updates.categorie = body.categorie ?? null;
  }
  if (typeof body.libelle === "string") {
    const t = body.libelle.trim();
    if (!t) return NextResponse.json({ error: "Libellé vide" }, { status: 400 });
    updates.libelle = t;
  }
  if ("montant_prevu" in body) updates.montant_prevu = body.montant_prevu ?? null;
  if ("montant_reel" in body) updates.montant_reel = body.montant_reel ?? null;
  if ("notes" in body) updates.notes = body.notes?.trim() || null;

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_budget_lines")
    .update(updates)
    .eq("id", bid)
    .eq("project_id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ligne budgétaire introuvable" }, { status: 404 });
  return NextResponse.json({ budget_line: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, bid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_budget_lines")
    .delete()
    .eq("id", bid)
    .eq("project_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

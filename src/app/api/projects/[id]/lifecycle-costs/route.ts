import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/projects/:id/lifecycle-costs — coûts années 1→10
// PUT /api/projects/:id/lifecycle-costs — upsert bulk (1 ligne / année)
//
// Body PUT : { rows: [{ annee, cout_fonctionnement, cout_entretien }, …] }
// Stratégie : upsert sur (project_id, annee). On supprime les années
// que le client retire pour pouvoir vider une ligne.

interface RouteParams { params: Promise<{ id: string }>; }

interface PutBody {
  rows?: { annee: number; cout_fonctionnement: number; cout_entretien: number }[];
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_lifecycle_costs")
    .select("*")
    .eq("project_id", id)
    .order("annee");
  return NextResponse.json({ rows: data ?? [] });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: PutBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const rows = (body.rows ?? []).filter(
    (r) => Number.isInteger(r.annee) && r.annee >= 1 && r.annee <= 10,
  );

  const service = await createServiceClient();

  // Supprime les années absentes du payload
  const yearsKept = rows.map((r) => r.annee);
  if (yearsKept.length === 0) {
    await service.from("project_lifecycle_costs").delete().eq("project_id", id);
  } else {
    await service
      .from("project_lifecycle_costs")
      .delete()
      .eq("project_id", id)
      .not("annee", "in", `(${yearsKept.join(",")})`);
  }

  if (rows.length > 0) {
    const payload = rows.map((r) => ({
      project_id: id,
      annee: r.annee,
      cout_fonctionnement: Number(r.cout_fonctionnement ?? 0),
      cout_entretien: Number(r.cout_entretien ?? 0),
    }));
    const { error } = await service
      .from("project_lifecycle_costs")
      .upsert(payload, { onConflict: "project_id,annee" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = await service
    .from("project_lifecycle_costs")
    .select("*")
    .eq("project_id", id)
    .order("annee");

  return NextResponse.json({ rows: data ?? [] });
}

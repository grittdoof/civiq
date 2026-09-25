import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { parseBudgetLine } from "@/lib/projects/money-validation";

// GET  /api/projects/:id/budget-lines
// POST /api/projects/:id/budget-lines
//
// La base de saisie et la section budgétaire sont imposées par le type :
//   investissement → HT, section d'investissement ;
//   événement / suivi → TTC, section de fonctionnement.

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_budget_lines")
    .select("*")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("sens")
    .order("created_at", { ascending: true });
  return NextResponse.json({ budget_lines: data ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseBudgetLine(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = await createServiceClient();
  const { data: project } = await service.from("projects").select("type_code").eq("id", id).maybeSingle();
  const invest = project?.type_code === "investissement";

  const { data, error } = await service
    .from("project_budget_lines")
    .insert({
      project_id: id,
      ...parsed.value,
      base: invest ? "ht" : "ttc",
      section: invest ? "investissement" : "fonctionnement",
      created_by: access.userId,
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.budget_line.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { budget_line_id: data.id, sens: data.sens, etat: data.etat },
  });
  return NextResponse.json({ budget_line: data });
}

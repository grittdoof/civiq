import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { parseBudgetLine } from "@/lib/projects/money-validation";
import { softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; bid: string }>; }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, bid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseBudgetLine(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("project_budget_lines")
    .update(parsed.value)
    .eq("id", bid)
    .eq("project_id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ligne budgétaire introuvable" }, { status: 404 });
  if (parsed.value.etat) {
    await writeAudit({
      action: "project.budget_line.updated",
      targetType: "project",
      targetId: id,
      communeId: access.communeId,
      metadata: { budget_line_id: bid, etat: parsed.value.etat },
    });
  }
  return NextResponse.json({ budget_line: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, bid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { error } = await service
    .from("project_budget_lines")
    .update(softDeleteFields(access.userId))
    .eq("id", bid)
    .eq("project_id", id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

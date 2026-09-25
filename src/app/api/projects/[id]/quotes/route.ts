import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess, requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { parseQuote } from "@/lib/projects/money-validation";
import { releaseOtherRetained, resolveQuoteRefs } from "@/lib/projects/quotes-server";

// GET  /api/projects/:id/quotes
// POST /api/projects/:id/quotes — montant HT obligatoire ; TTC calculé en base.

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const { data } = await service
    .from("project_quotes")
    .select("*")
    .is("deleted_at", null)
    .eq("project_id", id)
    .order("lot", { nullsFirst: true })
    .order("montant_ht", { ascending: true });
  return NextResponse.json({ quotes: data ?? [] });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseQuote(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = await createServiceClient();
  const refs = await resolveQuoteRefs(service, id, access.communeId, access.userId, parsed.value);
  if (!refs.ok) return NextResponse.json({ error: refs.error }, { status: 404 });
  const fields = { statut: "recu" as const, ...refs.fields };
  if (fields.statut === "retenu") await releaseOtherRetained(service, id, null, fields.lot ?? null);

  const { data, error } = await service
    .from("project_quotes")
    .insert({ project_id: id, ...fields, created_by: access.userId })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });
  await writeAudit({
    action: "project.quote.created",
    targetType: "project",
    targetId: id,
    communeId: access.communeId,
    metadata: { quote_id: data.id, montant_ht: data.montant_ht, statut: data.statut },
  });
  return NextResponse.json({ quote: data });
}

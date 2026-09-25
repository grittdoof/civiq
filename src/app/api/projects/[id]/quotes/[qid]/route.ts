import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { parseQuote } from "@/lib/projects/money-validation";
import { releaseOtherRetained, resolveQuoteRefs } from "@/lib/projects/quotes-server";
import { softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; qid: string }>; }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, qid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseQuote(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const service = await createServiceClient();
  const { data: current } = await service
    .from("project_quotes").select("id, lot").eq("id", qid).eq("project_id", id).is("deleted_at", null).maybeSingle();
  if (!current) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

  const refs = await resolveQuoteRefs(service, id, access.communeId, access.userId, parsed.value);
  if (!refs.ok) return NextResponse.json({ error: refs.error }, { status: 404 });
  if (refs.fields.statut === "retenu") {
    const lot = "lot" in refs.fields ? refs.fields.lot ?? null : (current.lot as string | null);
    await releaseOtherRetained(service, id, qid, lot);
  }

  const { data, error } = await service
    .from("project_quotes")
    .update(refs.fields)
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
    .update(softDeleteFields(access.userId))
    .eq("id", qid)
    .eq("project_id", id)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

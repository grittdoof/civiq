import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { softDeleteFields } from "@/lib/projects/soft-delete";
import { parseFinanceurLocal } from "@/lib/aides/financeurs-locaux";

interface RouteParams { params: Promise<{ fid: string }>; }

async function guardAdmin() {
  const guard = await requireModule("projects");
  if (!guard.ok) return { ok: false as const, response: guard.response };
  if (!guard.communeId) return { ok: false as const, response: NextResponse.json({ error: "Aucune commune" }, { status: 403 }) };
  if (!["admin", "super_admin"].includes(guard.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Réservé aux administrateurs de la commune" }, { status: 403 }) };
  }
  return { ok: true as const, guard };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const g = await guardAdmin();
  if (!g.ok) return g.response;
  const { fid } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const parsed = parseFinanceurLocal(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service.from("financeurs_locaux").update(parsed.value)
    .eq("id", fid).eq("commune_id", g.guard.communeId).is("deleted_at", null).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
  return NextResponse.json({ financeur: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const g = await guardAdmin();
  if (!g.ok) return g.response;
  const { fid } = await params;
  const service = await createServiceClient();
  const { error } = await service.from("financeurs_locaux").update(softDeleteFields(g.guard.userId))
    .eq("id", fid).eq("commune_id", g.guard.communeId).is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

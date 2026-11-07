import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";
import { lireSite } from "@/lib/tickets/periscolaire";

// ═══════════════════════════════════════════════════════════════
// PATCH  /api/tickets/sites/:id — { nom, type, adresse? }
// DELETE /api/tickets/sites/:id — suppression logique : les tickets
//   rattachés gardent le lieu dans leur historique.
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  let site;
  try { site = lireSite(await req.json().catch(() => null)); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { data, error } = await g.service.from("sites").update(site)
    .eq("id", id).eq("commune_id", g.communeId).is("deleted_at", null).select("id, nom, type, adresse").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lieu introuvable" }, { status: 404 });
  return NextResponse.json({ site: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  const { data, error } = await g.service.from("sites").update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("commune_id", g.communeId).is("deleted_at", null).select("id, nom").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lieu introuvable" }, { status: 404 });
  await writeAudit({ action: "tickets.site_supprime", targetType: "site", targetId: id, communeId: g.communeId, metadata: { nom: data.nom } });
  return NextResponse.json({ ok: true });
}

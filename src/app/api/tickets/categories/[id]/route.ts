import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";
import { COLONNES_CATEGORIE } from "@/lib/tickets/categories-server";
import { validerReglages } from "@/lib/tickets/categories-validation";
import { NOMS_ICONES } from "@/components/tickets/IconeCategorie";

// ═══════════════════════════════════════════════════════════════
// PATCH  /api/tickets/categories/:id — réglages (libellé, service par
//        défaut, urgence, visibilité, délai, gestionnaire, consigne,
//        actif, ordre, icône)
// DELETE /api/tickets/categories/:id — suppression logique (catégorie
//        et ses sous-catégories) ; les signalements gardent leur
//        rattachement, la catégorie n'est plus proposée.
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  const { data: cat } = await g.service.from("ticket_categories").select("id, parent_id, libelle")
    .eq("id", id).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
  if (!cat) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  let reglages;
  try { reglages = validerReglages(body, NOMS_ICONES); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Réglages invalides" }, { status: 400 }); }
  if (cat.parent_id) delete reglages.icone;
  if (reglages.service_defaut_id) {
    const { data: svc } = await g.service.from("services").select("id")
      .eq("id", reglages.service_defaut_id).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
    if (!svc) return NextResponse.json({ error: "Service inconnu" }, { status: 400 });
  }
  if (Object.keys(reglages).length === 0) return NextResponse.json({ ok: true });

  const { data, error } = await g.service.from("ticket_categories").update(reglages).eq("id", id)
    .select(COLONNES_CATEGORIE).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.categorie_modifiee", targetType: "ticket_categorie", targetId: id, communeId: g.communeId, metadata: { libelle: cat.libelle, champs: Object.keys(reglages) } });
  return NextResponse.json({ categorie: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const { id } = await params;
  const { data: cat } = await g.service.from("ticket_categories").select("id, code, libelle")
    .eq("id", id).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
  if (!cat) return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
  if (cat.code === "autre") return NextResponse.json({ error: "La catégorie « Autre » est indispensable" }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await g.service.from("ticket_categories").update({ deleted_at: now })
    .eq("commune_id", g.communeId).or(`id.eq.${id},parent_id.eq.${id}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.categorie_supprimee", targetType: "ticket_categorie", targetId: id, communeId: g.communeId, metadata: { libelle: cat.libelle } });
  return NextResponse.json({ ok: true });
}

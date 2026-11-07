import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";
import { COLONNES_CATEGORIE, listerCategories } from "@/lib/tickets/categories-server";
import { codeDepuisLibelle, validerReglages } from "@/lib/tickets/categories-validation";
import { NOMS_ICONES } from "@/components/tickets/IconeCategorie";

// ═══════════════════════════════════════════════════════════════
// GET  /api/tickets/categories — taxonomie de la commune (toutes)
// POST /api/tickets/categories — { libelle, parent_id?, …réglages }
// Réservé à l'administrateur de la commune et au super-admin (lot 2).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  return NextResponse.json({ categories: await listerCategories(g.service, g.communeId) });
}

export async function POST(req: NextRequest) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  let reglages;
  try {
    reglages = validerReglages(body, NOMS_ICONES);
    if (!reglages.libelle) throw new Error("Libellé : 2 à 80 caractères");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Réglages invalides" }, { status: 400 });
  }

  const parentId = typeof body.parent_id === "string" ? body.parent_id : null;
  if (parentId) {
    const { data: parent } = await g.service
      .from("ticket_categories").select("id, parent_id")
      .eq("id", parentId).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
    if (!parent || parent.parent_id) return NextResponse.json({ error: "Catégorie parente introuvable" }, { status: 400 });
  }
  if (reglages.service_defaut_id) {
    const { data: svc } = await g.service.from("services").select("id")
      .eq("id", reglages.service_defaut_id).eq("commune_id", g.communeId).is("deleted_at", null).maybeSingle();
    if (!svc) return NextResponse.json({ error: "Service inconnu" }, { status: 400 });
  }

  // Code unique dans la commune
  const base = codeDepuisLibelle(reglages.libelle!);
  const { data: existants } = await g.service.from("ticket_categories").select("code")
    .eq("commune_id", g.communeId).is("deleted_at", null).like("code", `${base}%`);
  const pris = new Set((existants ?? []).map((e) => e.code as string));
  let code = base;
  for (let i = 2; pris.has(code); i++) code = `${base}_${i}`;

  const { count } = await g.service.from("ticket_categories").select("id", { count: "exact", head: true })
    .eq("commune_id", g.communeId).is("deleted_at", null)
    .filter("parent_id", parentId ? "eq" : "is", parentId ?? null);

  const { data, error } = await g.service
    .from("ticket_categories")
    .insert({
      ...reglages, commune_id: g.communeId, parent_id: parentId, code, ordre: (count ?? 0) + 1,
      icone: parentId ? null : reglages.icone ?? "circle-help",
      // Ancienne catégorie (statistiques, PDF) : héritée du parent, sinon « autre »
      code_legacy: parentId ? null : "autre",
    })
    .select(COLONNES_CATEGORIE)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.categorie_creee", targetType: "ticket_categorie", targetId: data.id, communeId: g.communeId, metadata: { libelle: reglages.libelle, parent_id: parentId } });
  return NextResponse.json({ categorie: data });
}

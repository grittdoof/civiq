import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices, listerEquipe, listerServices, nomServiceValide } from "@/lib/tickets/services-server";

// ═══════════════════════════════════════════════════════════════
// GET  /api/tickets/services — services de la commune + équipe
// POST /api/tickets/services — { nom } crée un service
// Réservé à l'administrateur de la commune et au super-admin (lot 1).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const [services, equipe] = await Promise.all([
    listerServices(g.service, g.communeId),
    listerEquipe(g.service, g.communeId),
  ]);
  return NextResponse.json({ services, equipe });
}

export async function POST(req: NextRequest) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => null)) as { nom?: unknown } | null;
  const nom = nomServiceValide(body?.nom);
  if (!nom) return NextResponse.json({ error: "Nom de service : 2 à 80 caractères" }, { status: 400 });

  const { count } = await g.service
    .from("services").select("id", { count: "exact", head: true })
    .eq("commune_id", g.communeId).is("deleted_at", null);
  const { data, error } = await g.service
    .from("services")
    .insert({ commune_id: g.communeId, nom, ordre: (count ?? 0) + 1, created_by: g.userId })
    .select("id, nom, ordre")
    .single();
  if (error) {
    const doublon = error.code === "23505";
    return NextResponse.json({ error: doublon ? "Un service porte déjà ce nom" : error.message }, { status: doublon ? 409 : 500 });
  }
  await writeAudit({ action: "tickets.service_cree", targetType: "service", targetId: data.id, communeId: g.communeId, metadata: { nom } });
  return NextResponse.json({ service: { ...data, membres: [] } });
}

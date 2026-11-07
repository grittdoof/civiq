import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";
import { lireSite } from "@/lib/tickets/periscolaire";

// ═══════════════════════════════════════════════════════════════
// POST /api/tickets/sites — { nom, type, adresse? } crée un lieu
// (école, accueil de loisirs…). Administrateur de la commune ou
// super-admin (lot 5).
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  let site;
  try { site = lireSite(await req.json().catch(() => null)); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { data, error } = await g.service.from("sites")
    .insert({ commune_id: g.communeId, ...site }).select("id, nom, type, adresse").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.site_cree", targetType: "site", targetId: data.id, communeId: g.communeId, metadata: { nom: site.nom } });
  return NextResponse.json({ site: data });
}

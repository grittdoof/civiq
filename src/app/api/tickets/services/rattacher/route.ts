import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices, rattachementsPossibles } from "@/lib/tickets/services-server";

// ═══════════════════════════════════════════════════════════════
// POST /api/tickets/services/rattacher — rattache les tickets sans
// service au service par défaut de leur catégorie. Ne touche jamais un
// ticket qui a déjà un service. Administrateur de la commune ou super-admin.
// ═══════════════════════════════════════════════════════════════

export async function POST() {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const groupes = await rattachementsPossibles(g.service, g.communeId);
  let total = 0;
  for (const [serviceId, ids] of groupes) {
    const { data, error } = await g.service.from("tickets").update({ service_id: serviceId })
      .in("id", ids).eq("commune_id", g.communeId).is("service_id", null).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    total += (data ?? []).length;
  }
  await writeAudit({
    action: "tickets.rattachement_services", targetType: "commune", targetId: g.communeId, communeId: g.communeId,
    metadata: { tickets: total, services: groupes.size },
  });
  revalidatePath("/admin/tickets");
  revalidatePath("/admin/tickets/pilotage");
  return NextResponse.json({ rattaches: total });
}

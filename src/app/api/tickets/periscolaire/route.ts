import { NextRequest, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";

// ═══════════════════════════════════════════════════════════════
// PUT /api/tickets/periscolaire — { effacement_mois: number | null }
// Délai d'effacement du prénom de l'enfant (lot 5). null = fin de
// l'année scolaire qui suit la clôture (par défaut).
// ═══════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => null)) as { effacement_mois?: unknown } | null;
  const m = body?.effacement_mois;
  if (m !== null && !(typeof m === "number" && Number.isInteger(m) && m >= 1 && m <= 36)) {
    return NextResponse.json({ error: "Délai : de 1 à 36 mois, ou fin de l'année scolaire" }, { status: 400 });
  }
  const { error } = await g.service.from("commune_settings").upsert(
    { commune_id: g.communeId, tickets_effacement_enfant_mois: m, updated_at: new Date().toISOString() },
    { onConflict: "commune_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await writeAudit({ action: "tickets.effacement_enfant", targetType: "commune", targetId: g.communeId, communeId: g.communeId, metadata: { mois: m ?? "fin d'année scolaire" } });
  return NextResponse.json({ ok: true });
}

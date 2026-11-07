import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { gardeGestionServices } from "@/lib/tickets/services-server";

// ═══════════════════════════════════════════════════════════════
// PUT /api/tickets/page-publique — { actif: boolean, categories: string[] | null }
// Page publique des interventions (lot 4 bis). Administrateur de la
// commune ou super-admin. `categories` null = thèmes par défaut.
// ═══════════════════════════════════════════════════════════════

export async function PUT(req: NextRequest) {
  const g = await gardeGestionServices();
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => null)) as { actif?: unknown; categories?: unknown } | null;
  if (!body || typeof body.actif !== "boolean") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  let categories: string[] | null = null;
  if (body.categories !== null && body.categories !== undefined) {
    if (!Array.isArray(body.categories) || body.categories.some((c) => typeof c !== "string")) {
      return NextResponse.json({ error: "Thèmes invalides" }, { status: 400 });
    }
    const voulus = [...new Set(body.categories as string[])];
    if (voulus.length > 0) {
      const { data } = await g.service.from("ticket_categories").select("id")
        .in("id", voulus).eq("commune_id", g.communeId).is("parent_id", null).is("deleted_at", null);
      if ((data ?? []).length !== voulus.length) return NextResponse.json({ error: "Thème inconnu" }, { status: 400 });
    }
    categories = voulus;
  }

  const { error } = await g.service.from("commune_settings").upsert(
    { commune_id: g.communeId, tickets_public_actif: body.actif, tickets_public_categories: categories, updated_at: new Date().toISOString() },
    { onConflict: "commune_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: commune } = await g.service.from("communes").select("slug").eq("id", g.communeId).maybeSingle();
  if (commune?.slug) revalidateTag(`tickets-public-${commune.slug}`);
  await writeAudit({ action: "tickets.page_publique", targetType: "commune", targetId: g.communeId, communeId: g.communeId, metadata: { actif: body.actif, themes: categories?.length ?? "défaut" } });
  return NextResponse.json({ ok: true });
}

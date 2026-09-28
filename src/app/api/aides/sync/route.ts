import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommuneSettings } from "@/lib/projects/queries";
import { synchroniserCommune } from "@/lib/aides/sync";

// POST /api/aides/sync — actualisation manuelle du cache de SA commune
// (administrateur), au plus une fois par heure. Hors rendu de page.

export const maxDuration = 60;

export async function POST() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Réservé aux administrateurs de la commune" }, { status: 403 });
  }
  const settings = await getCommuneSettings(guard.communeId);
  if (!settings.code_insee) {
    return NextResponse.json({ error: "Renseignez d'abord le code INSEE dans les paramètres de la commune." }, { status: 400 });
  }
  const service = await createServiceClient();
  const { data: last } = await service
    .from("aides_sync_log").select("started_at").eq("commune_id", guard.communeId)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - Date.parse(last.started_at as string) < 60 * 60 * 1000) {
    return NextResponse.json({ error: "Une actualisation a déjà eu lieu il y a moins d'une heure." }, { status: 429 });
  }
  const r = await synchroniserCommune(service, guard.communeId, settings.code_insee);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

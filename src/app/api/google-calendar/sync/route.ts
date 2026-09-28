import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { synchroniserProfil } from "@/lib/calendar/google";

// POST /api/google-calendar/sync — « Synchroniser maintenant » (au plus 1×/min).

export const maxDuration = 60;

export async function POST() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  const service = await createServiceClient();
  const { data: lien } = await service
    .from("google_calendar_links")
    .select("last_sync_at")
    .eq("profile_id", guard.userId)
    .maybeSingle();
  if (lien?.last_sync_at && Date.now() - Date.parse(lien.last_sync_at as string) < 60_000) {
    return NextResponse.json({ ok: false, erreur: "Synchronisation déjà faite il y a moins d'une minute." }, { status: 429 });
  }
  const r = await synchroniserProfil(service, guard.userId);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

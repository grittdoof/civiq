import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { lirePerimetre } from "@/lib/calendar/feed";
import { dechiffrer, revoquer, synchroniserProfil } from "@/lib/calendar/google";

// PATCH  /api/google-calendar { perimetre } — puis resynchronise
// DELETE /api/google-calendar — déconnecte (jeton révoqué chez Google).
// L'agenda « GoCiviq » reste dans le compte Google de l'élu, qui peut le supprimer.

export const maxDuration = 60;

export async function PATCH(req: Request) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as { perimetre?: unknown };
  const perimetre = lirePerimetre(body.perimetre);
  if (!perimetre) return NextResponse.json({ error: "Périmètre invalide" }, { status: 400 });
  const service = await createServiceClient();
  await service.from("google_calendar_links").update({ perimetre }).eq("profile_id", guard.userId);
  const r = await synchroniserProfil(service, guard.userId);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}

export async function DELETE() {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  const service = await createServiceClient();
  const { data: lien } = await service
    .from("google_calendar_links")
    .select("refresh_token_enc")
    .eq("profile_id", guard.userId)
    .maybeSingle();
  if (lien?.refresh_token_enc) {
    try {
      await revoquer(dechiffrer(lien.refresh_token_enc as string));
    } catch {
      /* jeton illisible : on déconnecte quand même */
    }
  }
  await service
    .from("google_calendar_links")
    .update({ disconnected_at: new Date().toISOString(), refresh_token_enc: null })
    .eq("profile_id", guard.userId);
  await service.from("google_calendar_events").delete().eq("profile_id", guard.userId);
  return NextResponse.json({ ok: true });
}

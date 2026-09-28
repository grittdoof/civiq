import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { cronAutorise } from "@/lib/aides/sync";
import { googleConfigure, synchroniserProfil } from "@/lib/calendar/google";

// Cron quotidien (vercel.json) — filet de sécurité de la synchronisation
// Google Agenda (les modifications sont normalement poussées aussitôt).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!googleConfigure()) return NextResponse.json({ skipped: "Google Agenda non configuré" });

  const service = await createServiceClient();
  const { data } = await service.from("google_calendar_links").select("profile_id").is("disconnected_at", null);
  let ok = 0, echecs = 0;
  for (const l of data ?? []) {
    const r = await synchroniserProfil(service, l.profile_id as string);
    if (r.ok) ok++; else echecs++;
  }
  return NextResponse.json({ ok, echecs });
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { communesASynchroniser, cronAutorise, synchroniserCommune } from "@/lib/aides/sync";

// Cron hebdomadaire (vercel.json) — rafraîchit le cache Aides-territoires
// de chaque commune ayant le module projets et un code INSEE.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = await createServiceClient();
  const communes = await communesASynchroniser(service);
  const resultats = [];
  for (const c of communes) {
    resultats.push({ commune_id: c.commune_id, ...(await synchroniserCommune(service, c.commune_id, c.code_insee)) });
  }
  return NextResponse.json({ communes: resultats.length, resultats });
}

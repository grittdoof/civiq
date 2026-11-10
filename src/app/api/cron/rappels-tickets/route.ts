import { NextRequest, NextResponse } from "next/server";
import { cronAutorise } from "@/lib/aides/sync";
import { declencherRappelsDus } from "@/lib/tickets/rappels-server";

// Cron quotidien (vercel.json, 6 h UTC = 7 h ou 8 h à Paris) — ouvre
// les tickets de rappel arrivés à leur date et prévient les personnes
// concernées (notification + email). Un rappel manqué part le lendemain.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await declencherRappelsDus());
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { cronAutorise } from "@/lib/aides/sync";

// Cron quotidien (vercel.json) — effacement du prénom de l'enfant des
// tickets périscolaires clôturés, à la date prévue par la commune
// (31 août qui suit la clôture par défaut). Lot 5, migration 061.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = await createServiceClient();
  const { data, error } = await service.rpc("purger_donnees_enfants");
  if (error) {
    console.error("[purge-periscolaire]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const effaces = (data as number | null) ?? 0;
  if (effaces > 0) {
    await service.from("audit_log").insert({
      action: "tickets.donnees_enfants_effacees", target_type: "ticket_periscolaire",
      metadata: { effaces, declencheur: "automatique" },
    });
  }
  return NextResponse.json({ effaces });
}

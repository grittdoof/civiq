import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { buildSessionIcs } from "@/lib/projects/convocation";
import { calendarInputFor, loadSessionContext } from "@/lib/projects/convocation-send";
import { getBaseUrl } from "@/lib/base-url";

// GET /api/convocations/:token/ics — fichier agenda de la séance.
// Lien « Apple » de l'email : iOS / macOS ouvrent directement
// Calendrier ; Outlook desktop et les autres agendas l'importent.

interface RouteParams { params: Promise<{ token: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const service = await createServiceClient();
  const { data: conv } = await service
    .from("session_convocations")
    .select("session_id")
    .eq("token", token)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });

  const ctx = await loadSessionContext(service, conv.session_id);
  if (!ctx) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });

  const ics = buildSessionIcs(calendarInputFor(ctx, `${getBaseUrl()}/convocation/${token}`));
  if (!ics) return NextResponse.json({ error: "Date invalide" }, { status: 422 });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="convocation.ics"',
      "Cache-Control": "no-store",
    },
  });
}

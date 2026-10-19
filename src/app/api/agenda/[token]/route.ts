import { servirFlux } from "@/lib/calendar/flux";

// GET /api/agenda/<jeton>.ics — flux iCal personnel (voir lib/calendar/flux).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return servirFlux(token);
}

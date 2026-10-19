import { servirFlux } from "@/lib/calendar/flux";

// GET /api/agenda/<jeton>/<nom-lisible>.ics — même flux ; le dernier
// segment ne sert qu'à donner un nom lisible à l'abonnement.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return servirFlux(token);
}

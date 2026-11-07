import { NextRequest, NextResponse } from "next/server";
import { chargerPagePublique } from "@/lib/tickets/public-server";
import { versCsv } from "@/lib/tickets/pilotage";

// GET /interventions/:slug/donnees?periode=30j|12m — chiffres publics en CSV
// (lot 4 bis) : par thème puis par mois. Aucune donnée individuelle.

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const periode = req.nextUrl.searchParams.get("periode") === "12m" ? "12m" : "30j";
  const page = await chargerPagePublique(slug, periode);
  if (!page) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const a = page.agregats;
  const lignes: Array<Array<string | number | null>> = [
    ...a.parTheme.map((t) => ["Thème", t.libelle, t.terminees, t.enCours, t.delaiMoyenJours]),
    ...a.parMois.map((m) => ["Mois", m.cle, m.terminees, null, null]),
  ];
  const csv = versCsv(["Type", "Libellé", "Terminées", "En cours", "Délai moyen (jours)"], lignes);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="interventions-${slug}-${periode}.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

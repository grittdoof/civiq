import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { chargerPortefeuille } from "@/lib/projects/portefeuille-server";
import { construirePpi } from "@/lib/projects/ppi";
import { PpiPDF, type PpiPdfData } from "@/lib/projects/pdf-ppi";

// ═══════════════════════════════════════════════════════════════
// GET /api/projects/ppi/pdf — export PDF du PPI (même calcul que la
// page : lib/projects/ppi.ts ; projets confidentiels filtrés).
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const [pf, service] = await Promise.all([chargerPortefeuille(guard.communeId), createServiceClient()]);
  const { data: commune } = await service.from("communes").select("name, logo_url").eq("id", guard.communeId).single();
  const ppi = construirePpi({ projets: pf.items, lignesParProjet: pf.lignesParProjet, subventionsParProjet: pf.subventionsParProjet, statuts: pf.statuts });

  const data: PpiPdfData = {
    communeName: commune?.name ?? "Commune",
    communeLogoUrl: commune?.logo_url ?? null,
    generatedAt: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }),
    byYear: ppi.annees.map((a) => ({
      year: a.annee,
      projects: a.lignes.map((l) => ({
        id: l.id,
        titre: l.titre,
        etat: l.etat,
        concerne_tiers: !!l.tiers,
        tiers_nom: l.tiers,
        budget_estime: l.montantHt,
        financing_total_demande: l.sollicite,
        financing_total_obtenu: l.obtenu,
      })),
    })),
    totals: {
      count: ppi.total.operations,
      budget: ppi.total.montantHt,
      demande: ppi.total.sollicite,
      obtenu: ppi.total.obtenu,
      reste: ppi.total.reste,
    },
  };

  const buffer = await renderToBuffer(PpiPDF({ data }));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ppi-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

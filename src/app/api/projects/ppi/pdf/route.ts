import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listProjects } from "@/lib/projects/queries";
import { PpiPDF, type PpiPdfData, type PpiPdfProject } from "@/lib/projects/pdf-ppi";

// ═══════════════════════════════════════════════════════════════
// GET /api/projects/ppi/pdf — export PDF du PPI complet
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function programmingYear(p: { date_creation?: string | null }): number {
  if (p.date_creation) return new Date(p.date_creation).getFullYear();
  return new Date().getFullYear();
}

export async function GET(_req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const projects = await listProjects(guard.communeId);
  const ppiProjects = projects.filter(
    (p) => !p.accompagne_sans_financer && p.in_ppi !== false,
  );

  // Récupère le nom + logo commune pour l'en-tête
  const service = await createServiceClient();
  const { data: commune } = await service
    .from("communes")
    .select("name, logo_url")
    .eq("id", guard.communeId)
    .single();

  // Groupement par année
  const byYearMap = new Map<number, PpiPdfProject[]>();
  for (const p of ppiProjects) {
    const y = programmingYear(p);
    const arr = byYearMap.get(y) ?? [];
    arr.push({
      id: p.id,
      titre: p.titre,
      phase: p.phase,
      concerne_tiers: p.concerne_tiers ?? false,
      tiers_nom: p.tiers_nom ?? null,
      budget_estime: Number(p.budget_estime ?? 0),
      financing_total_demande: p.financing_total_demande ?? 0,
      financing_total_obtenu: p.financing_total_obtenu ?? 0,
    });
    byYearMap.set(y, arr);
  }
  const byYear = Array.from(byYearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, list]) => ({ year, projects: list }));

  const totals = ppiProjects.reduce(
    (acc, p) => {
      const budget = Number(p.budget_estime ?? 0);
      const demande = p.financing_total_demande ?? 0;
      const obtenu = p.financing_total_obtenu ?? 0;
      return {
        count: acc.count + 1,
        budget: acc.budget + budget,
        demande: acc.demande + demande,
        obtenu: acc.obtenu + obtenu,
        reste: acc.reste + (budget - obtenu),
      };
    },
    { count: 0, budget: 0, demande: 0, obtenu: 0, reste: 0 },
  );

  const data: PpiPdfData = {
    communeName: commune?.name ?? "Commune",
    communeLogoUrl: commune?.logo_url ?? null,
    generatedAt: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    byYear,
    totals,
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

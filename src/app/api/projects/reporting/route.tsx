import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { chargerPortefeuille } from "@/lib/projects/portefeuille-server";
import { enveloppeCommune } from "@/lib/projects/fiche-server";
import { construireReporting, filtrerProjets, libelleFiltres, lireFiltres } from "@/lib/projects/pilotage";
import { ReportingPDF } from "@/lib/projects/pdf-pilotage";
import { reportingDocx } from "@/lib/projects/docx-pilotage";

// GET /api/projects/reporting?format=pdf|docx&commission=&type=&statut=
// Reporting en puces hiérarchisées (brief §2.12) — étapes marquées
// « remonter au reporting », jamais de note interne.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const format = q.get("format") === "docx" ? "docx" : "pdf";
  const filtres = lireFiltres(Object.fromEntries(q.entries()));
  const [pf, env] = await Promise.all([chargerPortefeuille(guard.communeId), enveloppeCommune(guard.communeId)]);
  const items = construireReporting(filtrerProjets(pf.projets, pf.statuts, filtres), pf.etapesParProjet);
  const sousTitre = libelleFiltres(filtres, pf.commissions, env.editedOn);

  const buffer = format === "docx" ? await reportingDocx(items, sousTitre, env) : await renderToBuffer(<ReportingPDF items={items} filtres={sousTitre} {...env} />);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="reporting-projets-${date}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

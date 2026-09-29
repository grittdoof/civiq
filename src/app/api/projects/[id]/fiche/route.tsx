import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireProjectAccess } from "@/lib/projects/api-helpers";
import { chargerFiche, enveloppeCommune } from "@/lib/projects/fiche-server";
import { nomFichier, type VarianteFiche } from "@/lib/projects/fiche";
import { FichePDF } from "@/lib/projects/pdf-pilotage";
import { ficheDocx } from "@/lib/projects/docx-pilotage";

// GET /api/projects/:id/fiche?format=pdf|docx&variante=complete|communicable
// Fiche projet A4 (brief §2.13). Projet confidentiel : 404 si invisible.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if (!access.ok) return access.response;

  const q = req.nextUrl.searchParams;
  const format = q.get("format") === "docx" ? "docx" : "pdf";
  const variante: VarianteFiche = q.get("variante") === "communicable" ? "communicable" : "complete";

  const [fiche, env] = await Promise.all([chargerFiche(access.communeId, id, variante), enveloppeCommune(access.communeId)]);
  if (!fiche) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const suffixe = variante === "communicable" ? "fiche-communicable" : "fiche-complete";
  const buffer = format === "docx" ? await ficheDocx(fiche, env) : await renderToBuffer(<FichePDF fiche={fiche} {...env} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${nomFichier(fiche.titre, suffixe, format)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

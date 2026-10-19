import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { documentCompteRendu } from "@/lib/projects/minutes-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const { sid } = await params;
  // Fichier déposé (PDF ou Word) s'il existe, sinon PDF généré.
  const doc = await documentCompteRendu(guard.communeId, sid);
  if (!doc.ok) return new NextResponse(doc.error, { status: doc.status });
  const nom = doc.filename.replace(/["\\\r\n]/g, "_");
  const ascii = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_");

  return new NextResponse(new Uint8Array(doc.buffer), {
    status: 200,
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${doc.contentType === "application/pdf" ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "no-store",
    },
  });
}

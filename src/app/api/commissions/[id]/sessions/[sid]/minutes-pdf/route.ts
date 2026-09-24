import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { buildMinutesPdf } from "@/lib/projects/minutes-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const { sid } = await params;
  const pdf = await buildMinutesPdf(guard.communeId, sid);
  if (!pdf.ok) return new NextResponse(pdf.error, { status: pdf.status });

  return new NextResponse(new Uint8Array(pdf.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

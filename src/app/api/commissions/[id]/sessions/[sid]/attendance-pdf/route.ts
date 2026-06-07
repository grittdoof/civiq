import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getSession } from "@/lib/projects/queries";
import { AttendancePDF } from "@/lib/projects/pdf-commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const { sid } = await params;
  const detail = await getSession(guard.communeId, sid);
  if (!detail.session) return new NextResponse("Séance introuvable", { status: 404 });

  const service = await createServiceClient();
  const { data: commune } = await service.from("communes").select("name").eq("id", guard.communeId).single();

  // Map attendance par user pour merge
  const att = new Map(detail.attendance.map((a) => [a.conseiller_user_id, a]));

  let secretaireNom: string | null = null;
  if (detail.session.secretaire_de_seance_user_id) {
    const { data: sec } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", detail.session.secretaire_de_seance_user_id)
      .maybeSingle();
    secretaireNom = sec?.full_name ?? null;
  }

  const buffer = await renderToBuffer(
    AttendancePDF({
      communeName: commune?.name ?? "Commune",
      commissionName: detail.commission?.nom ?? "Commission",
      dateSeance: new Date(detail.session.date_seance).toLocaleString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
      lieu: detail.session.lieu,
      ordreDuJour: detail.session.ordre_du_jour,
      secretaireNom,
      members: detail.members.map((m) => {
        const a = att.get(m.user_id);
        return {
          full_name: m.profile?.full_name ?? "—",
          role: m.role,
          present: a?.present ?? null,
          signature_data: a?.signature_data ?? null,
          signe_le: a?.signe_le ?? null,
        };
      }),
      generatedAt: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="emargement-${sid}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

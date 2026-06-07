import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getSession } from "@/lib/projects/queries";
import { MinutesPDF } from "@/lib/projects/pdf-commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams { params: Promise<{ id: string; sid: string }>; }

const DECISION_LABELS: Record<string, string> = {
  decision: "Décision",
  avis_favorable: "Avis favorable",
  avis_defavorable: "Avis défavorable",
  action: "Action",
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const { sid } = await params;
  const detail = await getSession(guard.communeId, sid);
  if (!detail.session) return new NextResponse("Séance introuvable", { status: 404 });
  if (!detail.session.compte_rendu_valide) {
    return new NextResponse("Le compte rendu n'est pas encore validé", { status: 409 });
  }

  const service = await createServiceClient();
  const { data: commune } = await service.from("communes").select("name, logo_url").eq("id", guard.communeId).single();

  let secretaireNom: string | null = null;
  if (detail.session.secretaire_de_seance_user_id) {
    const { data: sec } = await service
      .from("profiles")
      .select("full_name")
      .eq("id", detail.session.secretaire_de_seance_user_id)
      .maybeSingle();
    secretaireNom = sec?.full_name ?? null;
  }

  const byUser = new Map<string, typeof detail.attendance[number]>();
  const byMember = new Map<string, typeof detail.attendance[number]>();
  for (const a of detail.attendance) {
    if (a.conseiller_user_id) byUser.set(a.conseiller_user_id, a);
    if (a.commission_member_id) byMember.set(a.commission_member_id, a);
  }
  const presents: string[] = [];
  const absents: string[] = [];
  for (const m of detail.members) {
    const name = m.profile?.full_name ?? m.external_name ?? "—";
    const a = m.user_id ? byUser.get(m.user_id) : byMember.get(m.id);
    if (a?.present === true) presents.push(name);
    else if (a?.present === false) absents.push(name);
  }

  // Récupérer les responsables des décisions (pour libelles)
  const decisionUserIds = detail.decisions
    .map((d) => d.responsable_user_id)
    .filter((u): u is string => !!u);
  let nameByUser = new Map<string, string>();
  if (decisionUserIds.length > 0) {
    const { data: profs } = await service
      .from("profiles")
      .select("id, full_name")
      .in("id", decisionUserIds);
    nameByUser = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
  }

  const buffer = await renderToBuffer(
    MinutesPDF({
      communeName: commune?.name ?? "Commune",
      communeLogoUrl: commune?.logo_url ?? null,
      commissionName: detail.commission?.nom ?? "Commission",
      dateSeance: new Date(detail.session.date_seance).toLocaleString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
      lieu: detail.session.lieu,
      ordreDuJour: detail.session.ordre_du_jour,
      secretaireNom,
      presents,
      absents,
      compteRendu: detail.session.compte_rendu ?? "",
      decisions: detail.decisions.map((d) => ({
        libelle: d.libelle,
        type: DECISION_LABELS[d.type] ?? d.type,
        responsable: d.responsable_user_id ? nameByUser.get(d.responsable_user_id) ?? null : null,
        echeance: d.echeance,
      })),
      generatedAt: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      validatedAt: detail.session.compte_rendu_valide_at
        ? new Date(detail.session.compte_rendu_valide_at).toLocaleDateString("fr-FR")
        : null,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="compte-rendu-${sid}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

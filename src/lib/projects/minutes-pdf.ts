import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase-server";
import { getSession } from "@/lib/projects/queries";
import { MinutesPDF } from "@/lib/projects/pdf-commission";

// ═══════════════════════════════════════════════════════════════
// Génération du PDF de compte rendu de séance.
// Partagé par le téléchargement (GET …/minutes-pdf) et l'envoi par
// email aux membres (POST …/minutes/send).
// ═══════════════════════════════════════════════════════════════

const DECISION_LABELS: Record<string, string> = {
  decision: "Décision",
  avis_favorable: "Avis favorable",
  avis_defavorable: "Avis défavorable",
  action: "Action",
};

export type MinutesPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; status: 404 | 409; error: string };

export async function buildMinutesPdf(communeId: string, sid: string): Promise<MinutesPdfResult> {
  const detail = await getSession(communeId, sid);
  if (!detail.session) return { ok: false, status: 404, error: "Séance introuvable" };
  if (!detail.session.compte_rendu_valide) {
    return { ok: false, status: 409, error: "Le compte rendu n'est pas encore validé" };
  }

  const service = await createServiceClient();
  const { data: commune } = await service.from("communes").select("name, logo_url").eq("id", communeId).single();

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

  const day = new Date(detail.session.date_seance).toISOString().slice(0, 10);
  const slug = (detail.commission?.nom ?? "commission")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return { ok: true, buffer: Buffer.from(buffer), filename: `compte-rendu-${slug}-${day}.pdf` };
}

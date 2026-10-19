import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase-server";
import { getSession } from "@/lib/projects/queries";
import { MinutesPDF } from "@/lib/projects/pdf-commission";
import { listeEmargement, repartition, type LigneSource, type MembreSource } from "./emargement";

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

  // Tous les membres figurent : présents, excusés, absents, non renseignés.
  const { presents, excuses, absents, nonRenseignes } = repartition(
    listeEmargement(detail.members as unknown as MembreSource[], detail.attendance as unknown as LigneSource[]),
  );

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
      excuses,
      nonRenseignes,
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

// ─── Compte rendu déposé en fichier (PDF / Word, migration 051) ───

export type DocumentCrResult =
  | { ok: true; buffer: Buffer; filename: string; contentType: string; depose: boolean }
  | { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Le compte rendu à transmettre : le fichier déposé s'il existe, sinon
 * le PDF généré à partir du texte rédigé. Validé dans les deux cas.
 */
export async function documentCompteRendu(communeId: string, sid: string): Promise<DocumentCrResult> {
  const service = await createServiceClient();
  const { data: s } = await service
    .from("commission_sessions")
    .select("id, commission_id, compte_rendu_valide, cr_fichier_path, cr_fichier_nom, cr_fichier_type")
    .eq("id", sid)
    .is("deleted_at", null)
    .maybeSingle();
  if (!s) return { ok: false, status: 404, error: "Séance introuvable" };
  const { data: c } = await service.from("commissions").select("commune_id").eq("id", s.commission_id).maybeSingle();
  if (!c || c.commune_id !== communeId) return { ok: false, status: 404, error: "Séance introuvable" };

  if (s.cr_fichier_path) {
    if (!s.compte_rendu_valide) return { ok: false, status: 409, error: "Le compte rendu n'est pas encore validé" };
    const { data: blob, error } = await service.storage.from("project-documents").download(s.cr_fichier_path as string);
    if (error || !blob) return { ok: false, status: 500, error: "Le fichier du compte rendu est introuvable." };
    return {
      ok: true,
      buffer: Buffer.from(await blob.arrayBuffer()),
      filename: (s.cr_fichier_nom as string | null) ?? "compte-rendu",
      contentType: (s.cr_fichier_type as string | null) ?? "application/octet-stream",
      depose: true,
    };
  }
  const pdf = await buildMinutesPdf(communeId, sid);
  if (!pdf.ok) return pdf;
  return { ...pdf, contentType: "application/pdf", depose: false };
}

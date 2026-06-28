import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getProject } from "@/lib/projects/queries";
import { ProjectPDF, type ProjectPdfData } from "@/lib/projects/pdf-document";
import { computeEcart } from "@/lib/projects/cost-calc";
import {
  PROJECT_PHASE_LABELS,
  PROJECT_PHASES,
  PROJECT_PHASE_GUIDE,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// GET /api/projects/:id/pdf — export PDF de la fiche projet.
// ═══════════════════════════════════════════════════════════════

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams { params: Promise<{ id: string }>; }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return new NextResponse("Aucune commune", { status: 403 });

  const { id } = await params;
  const detail = await getProject(guard.communeId, id);
  if (!detail.project) return new NextResponse("Projet introuvable", { status: 404 });
  const p = detail.project;

  const service = await createServiceClient();
  const { data: commune } = await service
    .from("communes")
    .select("name, logo_url")
    .eq("id", guard.communeId)
    .single();

  const ecart = computeEcart(p.budget_estime, p.cout_reel);
  const phaseIdx = ["emergence","faisabilite","decision_budget","financement","conception_marches","realisation","bilan_cloture"].indexOf(p.phase);
  const showBilan = phaseIdx >= 5; // à partir de realisation

  // Construit le résumé d'avancement par phase pour le PDF public.
  const progress = (p.phase_progress ?? {}) as Record<
    string,
    Record<string, { done: boolean; note: string | null }>
  >;
  const resourceCounts = {
    documents: detail.documents.length,
    stakeholders: detail.stakeholders.length,
    financings: detail.financings.length,
    milestones: detail.milestones.length,
  };
  const phase_progress_summary = PROJECT_PHASES.map((phase, idx) => {
    const guide = PROJECT_PHASE_GUIDE[phase];
    const phaseData = progress[phase] ?? {};
    const status: "done" | "current" | "future" =
      idx < phaseIdx ? "done" : idx === phaseIdx ? "current" : "future";
    const deliverables = guide.deliverables.map((spec, di) => {
      const manual = phaseData[String(di)] ?? { done: false, note: null };
      let done = manual.done;
      if (spec.kind === "identity" && p.titre && p.titre !== "Sans titre") done = true;
      if (spec.kind === "field" && spec.link === "objectifs" && (p.pilote_elu || p.pilote_agent)) done = true;
      if (spec.kind === "field" && spec.link === "lifecycle" && p.budget_estime > 0) done = true;
      if (spec.kind === "field" && spec.link === "bilan" && (p.cout_reel !== null || p.explication_ecart)) done = true;
      if (spec.kind === "document" && resourceCounts.documents > 0) done = true;
      if (spec.kind === "stakeholder" && resourceCounts.stakeholders > 0) done = true;
      if (spec.kind === "financing" && resourceCounts.financings > 0) done = true;
      if (spec.kind === "milestone" && resourceCounts.milestones > 0) done = true;
      return { label: spec.label, kind: spec.kind, done, note: manual.note };
    });
    const doneCount = deliverables.filter((d) => d.done).length;
    const pctDone = deliverables.length > 0
      ? Math.round((doneCount / deliverables.length) * 100)
      : 0;
    return {
      phase,
      label: PROJECT_PHASE_LABELS[phase],
      objective: guide.objective,
      deliverables,
      pctDone,
      status,
    };
  });

  const pdfData: ProjectPdfData = {
    communeName: commune?.name ?? "Commune",
    communeLogoUrl: commune?.logo_url ?? null,
    generatedAt: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    titre: p.titre,
    description: p.description,
    objectifs: p.objectifs,
    competence: labelCompetence(p.competence),
    phase: p.phase,
    pilote_elu: p.pilote_elu_profile?.full_name ?? null,
    pilote_agent: p.pilote_agent_profile?.full_name ?? null,
    sans_subvention: p.sans_subvention,
    source_ticket_label: detail.source_ticket
      ? `#${detail.source_ticket.numero} — ${detail.source_ticket.titre}`
      : null,
    budget_estime: p.budget_estime,
    cost_total_nominal: detail.global_cost?.total_nominal ?? p.budget_estime,
    cost_total_actualise: detail.global_cost?.total_actualise ?? p.budget_estime,
    taux_inflation: detail.global_cost?.taux_inflation_used ?? 2.0,
    taux_actualisation: detail.global_cost?.taux_actualisation_used ?? 4.0,
    financings: detail.financings.map((f) => ({
      financeur: f.financeur,
      montant_demande: f.montant_demande,
      montant_obtenu: f.montant_obtenu,
      statut: f.statut,
    })),
    milestones: detail.milestones.map((m) => ({
      phase: m.phase,
      libelle: m.libelle,
      echeance: m.echeance,
      fait: m.fait,
    })),
    lifecycle: detail.lifecycle.map((l) => ({
      annee: l.annee,
      cout_fonctionnement: Number(l.cout_fonctionnement),
      cout_entretien: Number(l.cout_entretien),
    })),
    stakeholders: detail.stakeholders
      .filter((ps) => ps.stakeholder)
      .map((ps) => ({
        nom: ps.stakeholder!.nom + (ps.stakeholder!.organisation ? ` (${ps.stakeholder!.organisation})` : ""),
        type: ps.stakeholder!.type,
        role: ps.role,
        phase: ps.phase,
      })),
    documents: detail.documents.map((d) => ({
      nom: d.nom,
      type: d.type,
      uploaded_at: d.uploaded_at,
    })),
    cout_reel: p.cout_reel,
    ecart_value: ecart?.value ?? null,
    ecart_pct: ecart?.pct ?? null,
    explication_ecart: p.explication_ecart,
    show_bilan: showBilan,
    phase_progress_summary,
  };

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(ProjectPDF(pdfData));
  } catch (e) {
    console.error("[pdf] project render:", e);
    return new NextResponse(
      "Erreur de génération du PDF : " + (e instanceof Error ? e.message : "inconnue"),
      { status: 500 },
    );
  }

  const slug = p.titre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const fileName = `projet-${slug || "fiche"}.pdf`;

  // pdfData not used directly here but kept to ensure types — ensure phaseLabel used
  void PROJECT_PHASE_LABELS;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function labelCompetence(c: string): string {
  switch (c) {
    case "communale": return "Communale";
    case "intercommunale": return "Intercommunale";
    case "a_verifier": return "À vérifier";
    default: return c;
  }
}

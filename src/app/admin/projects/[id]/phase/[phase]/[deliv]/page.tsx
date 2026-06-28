import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getProject } from "@/lib/projects/queries";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
} from "@/lib/projects/types";
import DeliverablePage from "@/components/projects/DeliverablePage";
import "../../../../projects.css";
import "../../../../flow.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id]/phase/[phase]/[deliv]
// Page focalisée pour un livrable. Dispatch selon le kind via
// DeliverablePage (Client Component).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; phase: string; deliv: string }>;
}

export default async function DeliverableFocusPage({ params }: Props) {
  const { id, phase: phaseParam, deliv } = await params;
  const phase = phaseParam as ProjectPhase;
  if (!PROJECT_PHASES.includes(phase)) notFound();
  const idx = Number.parseInt(deliv, 10);
  if (Number.isNaN(idx)) notFound();

  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const detail = await getProject(ctx.communeId, id);
  if (!detail.project) notFound();
  const p = detail.project;
  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");

  const guide = PROJECT_PHASE_GUIDE[phase];
  const spec = guide.deliverables[idx];
  if (!spec) notFound();

  // Annuaire commune pour les pickers (parties prenantes, profils)
  const service = await createServiceClient();
  const { data: profilesDir } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("commune_id", ctx.communeId);

  const phaseIdx = PROJECT_PHASES.indexOf(phase);
  const nextDelivIdx = idx + 1 < guide.deliverables.length ? idx + 1 : null;
  const nextPhase = phaseIdx < PROJECT_PHASES.length - 1
    ? PROJECT_PHASES[phaseIdx + 1]
    : null;

  const progress = (p.phase_progress ?? {}) as Record<
    string,
    Record<string, { done: boolean; note: string | null }>
  >;
  const manual = progress[phase]?.[String(idx)] ?? { done: false, note: null };

  return (
    <main className="civiq-main pj-flow-page">
      <div className="pj-flow-topbar">
        <div className="pj-flow-topbar-title">
          <Link
            href={`/admin/projects/${id}/phase/${phase}`}
            className="pj-flow-back-pill"
            title="Retour à la phase"
            prefetch={false}
          >
            <ArrowLeft size={14} />
          </Link>
          <h1 className="pj-flow-project-title">
            {PROJECT_PHASE_LABELS[phase]} ·{" "}
            <span style={{ fontWeight: 500, opacity: 0.7 }}>
              Livrable {idx + 1}/{guide.deliverables.length}
            </span>
          </h1>
        </div>
      </div>

      <DeliverablePage
        projectId={p.id}
        phase={phase}
        deliverableIdx={idx}
        spec={spec}
        manual={manual}
        currentProject={{
          titre: p.titre,
          description: p.description,
          objectifs: p.objectifs,
          competence: p.competence,
          pilote_elu: p.pilote_elu,
          pilote_agent: p.pilote_agent,
          budget_estime: p.budget_estime,
          taux_inflation: p.taux_inflation,
          taux_actualisation: p.taux_actualisation,
          cout_reel: p.cout_reel,
          explication_ecart: p.explication_ecart,
          photo_url: p.photo_url ?? null,
        }}
        profilesDirectory={
          (profilesDir ?? []) as Array<{
            id: string;
            full_name: string | null;
            job_title: string | null;
          }>
        }
        nextDeliverableIdx={nextDelivIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </main>
  );
}

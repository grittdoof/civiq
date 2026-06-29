import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowRight, CheckCircle2, Circle, MinusCircle, FolderOpen, FileText, FileDown } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getProject } from "@/lib/projects/queries";
import {
  PROJECT_PHASES_BY_TYPE,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
  type DeliverableKind,
} from "@/lib/projects/types";
import {
  computeDeliverableState,
  computePhaseProgress,
  type PhaseProgress,
} from "@/lib/projects/progress";
import ProjectStepper from "@/components/projects/ProjectStepper";
import PhaseIcon from "@/components/projects/PhaseIcon";
import "../../../projects.css";
import "../../../flow.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id]/phase/[phase] — Workspace de phase.
//
// Hero compact + liste des livrables. Chaque livrable est un Link
// vers /phase/[phase]/[idx] qui ouvrira la page dédiée focalisée
// (Phase B+).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; phase: string }>;
}

const KIND_LABEL: Record<DeliverableKind, string> = {
  task: "Tâche",
  document: "Document",
  stakeholder: "Partie prenante",
  financing: "Financement",
  milestone: "Jalon",
  field: "À remplir",
  identity: "Identité",
  deliberation: "Délibération",
  authorization: "Autorisation",
  communication: "Communication",
  budget: "Budget",
};

export default async function ProjectPhasePage({ params }: Props) {
  const { id, phase: phaseParam } = await params;
  const phase = phaseParam as ProjectPhase;
  if (!(phase in PROJECT_PHASE_LABELS)) notFound();

  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const detail = await getProject(ctx.communeId, id);
  if (!detail.project) notFound();
  const p = detail.project;
  // La phase doit appartenir au gabarit du projet
  const phasesForType = PROJECT_PHASES_BY_TYPE[p.type];
  if (!phasesForType.includes(phase)) notFound();
  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");

  const progress = (p.phase_progress ?? {}) as PhaseProgress;
  const resourceCounts = {
    documents: detail.documents.length,
    stakeholders: detail.stakeholders.length,
    financings: detail.financings.length,
    milestones: detail.milestones.length,
  };

  const guide = PROJECT_PHASE_GUIDE[phase];

  // États individuels (done + applicable + note) par index de livrable
  const deliverableStates = guide.deliverables.map((spec, idx) =>
    computeDeliverableState(progress, phase, idx, spec, p, resourceCounts),
  );

  // Résumé obligatoire applicable uniquement
  const summary = computePhaseProgress(
    progress, phase, guide.deliverables, p, resourceCounts,
  );
  const doneCount = summary.done;
  const total = summary.total;
  const pctDone = summary.pct;
  const allDone = total === 0 || doneCount === total;
  const firstTodoIdx = summary.firstTodoIdx;
  const firstTodo = firstTodoIdx >= 0 ? guide.deliverables[firstTodoIdx] : null;
  const remaining = Math.max(total - doneCount, 0);

  const phaseIdx = phasesForType.indexOf(phase);
  const nextPhase = phaseIdx < phasesForType.length - 1
    ? phasesForType[phaseIdx + 1]
    : null;

  return (
    <main className="civiq-main pj-flow-page">
      {/* Topbar : titre projet + actions (Voir fiche / Export PDF) */}
      <div className="pj-flow-topbar">
        <div className="pj-flow-topbar-title">
          <Link
            href="/admin/projects"
            className="pj-flow-back-pill"
            title="Retour à la liste"
          >
            ←
          </Link>
          <h1 className="pj-flow-project-title">{p.titre}</h1>
        </div>
        {canEdit && (
          <div className="pj-flow-topbar-actions">
            <Link
              href={`/admin/projects/${p.id}/fiche`}
              className="civiq-btn civiq-btn-outline civiq-btn-sm"
              prefetch={false}
            >
              <FolderOpen size={13} /> <span>Fiche projet</span>
            </Link>
            <a
              href={`/projects-pdf?kind=project&id=${p.id}`}
              className="civiq-btn civiq-btn-outline civiq-btn-sm"
              target="_blank"
              rel="noreferrer"
            >
              <FileDown size={13} /> <span>PDF</span>
            </a>
          </div>
        )}
      </div>

      {/* Stepper horizontal cliquable */}
      <ProjectStepper
        current={p.phase}
        focused={phase}
        projectId={p.id}
      />

      {/* Hero phase compact */}
      <header className="pj-flow-hero">
        <div className="pj-flow-hero-icon" aria-hidden>
          <PhaseIcon phase={phase} size={22} strokeWidth={1.8} />
        </div>
        <div className="pj-flow-hero-text">
          <div className="pj-flow-hero-eyebrow">
            Étape {phaseIdx + 1} sur {phasesForType.length}
          </div>
          <h2 className="pj-flow-hero-title">{PROJECT_PHASE_LABELS[phase]}</h2>
          <p className="pj-flow-hero-objective">{guide.objective}</p>
        </div>
        <div className="pj-flow-hero-progress">
          <span className="pj-flow-hero-progress-num">{pctDone}%</span>
          <div className="pj-flow-hero-progress-bar" aria-hidden>
            <div
              className="pj-flow-hero-progress-fill"
              style={{ width: `${pctDone}%` }}
            />
          </div>
          <span className="pj-flow-hero-progress-meta">
            {doneCount}/{total} livrables
          </span>
        </div>
      </header>

      {firstTodo && (
        <section className="pj-flow-focus-card" aria-label="Prochain livrable à compléter">
          <div className="pj-flow-focus-copy">
            <span className="pj-flow-focus-kicker">À faire maintenant</span>
            <h3>{firstTodo.label}</h3>
            <p>
              Complétez ce livrable pour faire avancer la phase{" "}
              {PROJECT_PHASE_LABELS[phase]}.
            </p>
          </div>
          <Link
            href={`/admin/projects/${p.id}/phase/${phase}/${firstTodoIdx}`}
            className="pj-flow-focus-action"
            prefetch={false}
          >
            Compléter <ArrowRight size={15} />
          </Link>
        </section>
      )}

      {/* Liste verticale des livrables */}
      <ul className="pj-flow-deliverables">
        {guide.deliverables.map((spec, idx) => {
          const state = deliverableStates[idx];
          const { done, applicable, note } = state;
          const cardClasses = [
            "pj-flow-deliverable-card",
            done && applicable ? "is-done" : "",
            !applicable ? "is-na" : "",
            spec.optional ? "is-optional" : "",
          ].filter(Boolean).join(" ");
          return (
            <li key={idx} className="pj-flow-deliverable-item">
              <Link
                href={`/admin/projects/${p.id}/phase/${phase}/${idx}`}
                className={cardClasses}
                style={{ ["--pj-item-index" as string]: idx }}
                prefetch={false}
              >
                <span className="pj-flow-deliverable-check" aria-hidden>
                  {!applicable ? (
                    <MinusCircle size={20} />
                  ) : done ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </span>
                <span className="pj-flow-deliverable-body">
                  <span className="pj-flow-deliverable-kind">
                    <FileText size={10} aria-hidden />
                    {KIND_LABEL[spec.kind]}
                    {spec.optional && (
                      <span className="pj-flow-deliverable-badge"> · optionnel</span>
                    )}
                    {!applicable && (
                      <span className="pj-flow-deliverable-badge pj-flow-deliverable-badge-na">
                        {" "}· non applicable
                      </span>
                    )}
                  </span>
                  <span className="pj-flow-deliverable-label">{spec.label}</span>
                  {note && (
                    <span className="pj-flow-deliverable-note">{note}</span>
                  )}
                </span>
                <span className="pj-flow-deliverable-go" aria-hidden>
                  <ChevronRight size={18} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Sticky bottom : CTA phase suivante si tout est fait */}
      <div className="pj-flow-bottom-cta">
        {allDone && nextPhase ? (
          <Link
            href={`/admin/projects/${p.id}/phase/${nextPhase}`}
            className="pj-flow-next-phase"
            prefetch={false}
          >
            <span className="pj-flow-next-phase-label">
              Étape complète · Passer à
            </span>
            <strong>{PROJECT_PHASE_LABELS[nextPhase]}</strong>
            <ArrowRight size={16} />
          </Link>
        ) : (
          <div className="pj-flow-next-phase is-muted" aria-live="polite">
            <span className="pj-flow-next-phase-label">
              {remaining} livrable{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}
            </span>
            <strong>{firstTodo ? "Continuez la phase" : "Phase en cours"}</strong>
          </div>
        )}
      </div>

      {/* Gate de passage (informatif) */}
      <div className="pj-flow-gate">
        <strong>Et après ?</strong>
        <p>{guide.gate}</p>
      </div>
    </main>
  );
}

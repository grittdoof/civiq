import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowRight, CheckCircle2, Circle, FolderOpen, FileText, FileDown } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getProject } from "@/lib/projects/queries";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
  type DeliverableKind,
} from "@/lib/projects/types";
import PhaseRail from "@/components/projects/PhaseRail";
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
};

export default async function ProjectPhasePage({ params }: Props) {
  const { id, phase: phaseParam } = await params;
  const phase = phaseParam as ProjectPhase;
  if (!PROJECT_PHASES.includes(phase)) notFound();

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

  function isDone(idx: number, kind: DeliverableKind): boolean {
    const manual = progress[phase]?.[String(idx)]?.done === true;
    if (manual) return true;
    if (kind === "document" && resourceCounts.documents > 0) return true;
    if (kind === "stakeholder" && resourceCounts.stakeholders > 0) return true;
    if (kind === "financing" && resourceCounts.financings > 0) return true;
    if (kind === "milestone" && resourceCounts.milestones > 0) return true;
    return false;
  }

  const guide = PROJECT_PHASE_GUIDE[phase];
  const doneCount = guide.deliverables.reduce(
    (n, d, i) => (isDone(i, d.kind) ? n + 1 : n),
    0,
  );
  const total = guide.deliverables.length;
  const pctDone = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = doneCount === total && total > 0;

  const phaseIdx = PROJECT_PHASES.indexOf(phase);
  const nextPhase = phaseIdx < PROJECT_PHASES.length - 1
    ? PROJECT_PHASES[phaseIdx + 1]
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

      {/* PhaseRail unifié */}
      <PhaseRail
        projectId={p.id}
        currentPhase={p.phase}
        focusedPhase={phase}
        progress={progress}
        resourceCounts={resourceCounts}
      />

      {/* Hero phase compact */}
      <header className="pj-flow-hero">
        <div className="pj-flow-hero-icon" aria-hidden>
          <PhaseIcon phase={phase} size={22} strokeWidth={1.8} />
        </div>
        <div className="pj-flow-hero-text">
          <div className="pj-flow-hero-eyebrow">
            Étape {phaseIdx + 1} sur {PROJECT_PHASES.length}
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

      {/* Liste verticale des livrables */}
      <ul className="pj-flow-deliverables">
        {guide.deliverables.map((spec, idx) => {
          const done = isDone(idx, spec.kind);
          const note = progress[phase]?.[String(idx)]?.note;
          return (
            <li key={idx} className="pj-flow-deliverable-item">
              <Link
                href={`/admin/projects/${p.id}/phase/${phase}/${idx}`}
                className={`pj-flow-deliverable-card${done ? " is-done" : ""}`}
                prefetch={false}
              >
                <span className="pj-flow-deliverable-check" aria-hidden>
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </span>
                <span className="pj-flow-deliverable-body">
                  <span className="pj-flow-deliverable-kind">
                    <FileText size={10} aria-hidden />
                    {KIND_LABEL[spec.kind]}
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
      {allDone && nextPhase && (
        <div className="pj-flow-bottom-cta">
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
        </div>
      )}

      {/* Gate de passage (informatif) */}
      <div className="pj-flow-gate">
        <strong>Et après ?</strong>
        <p>{guide.gate}</p>
      </div>
    </main>
  );
}

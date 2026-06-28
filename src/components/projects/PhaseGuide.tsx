"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  MapPin,
  Target,
  Lock,
  Loader2,
  FileText,
  Users,
  Wallet,
  Flag,
  PencilLine,
  ListChecks,
} from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
  type DeliverableKind,
  type DeliverableSpec,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

// ═══════════════════════════════════════════════════════════════
// PhaseGuide — point d'entrée principal pour configurer le projet.
//
// Chaque livrable d'une phase est lié à une ressource concrète de
// la fiche projet :
//   - kind="document"    → auto-coché dès qu'au moins 1 document
//                          est attaché ; bouton « Ajouter un
//                          document » qui ouvre la section
//                          documents de la fiche.
//   - kind="stakeholder" → auto-coché dès qu'au moins 1 partie
//                          prenante est rattachée ; bouton ouvre
//                          la section parties prenantes.
//   - kind="financing"   → auto-coché dès qu'au moins 1 ligne de
//                          financement existe.
//   - kind="milestone"   → auto-coché dès qu'au moins 1 jalon.
//   - kind="task"        → coche manuelle + note libre, stockée
//                          dans projects.phase_progress.
//   - kind="field"       → renvoie vers le champ de la fiche
//                          projet à remplir.
//
// L'utilisateur configure le projet en cochant ses livrables phase
// après phase. La fiche projet se remplit automatiquement.
// ═══════════════════════════════════════════════════════════════

type ProgressMap = Record<
  string,
  Record<string, { done: boolean; note: string | null }>
>;

interface ResourceCounts {
  documents: number;
  stakeholders: number;
  financings: number;
  milestones: number;
}

interface Props {
  projectId: string;
  currentPhase: ProjectPhase;
  initialProgress: ProgressMap;
  /** Compteurs des ressources de la fiche projet, pour l'auto-détection. */
  resourceCounts: ResourceCounts;
  canEdit: boolean;
}

// Mapping link → URL fragment de la fiche projet
const LINK_ANCHOR: Record<string, string> = {
  documents: "documents",
  stakeholders: "parties-prenantes",
  financings: "plan-financement",
  milestones: "etapes-cles",
  objectifs: "objectifs",
  lifecycle: "couts-10-ans",
  bilan: "bilan",
  commissions: "commissions",
};

// Mapping link → libellé du CTA
const LINK_CTA_LABEL: Record<string, string> = {
  documents: "Ajouter un document",
  stakeholders: "Associer une partie prenante",
  financings: "Ajouter un financement",
  milestones: "Ajouter un jalon",
  objectifs: "Renseigner les objectifs",
  lifecycle: "Compléter les coûts 10 ans",
  bilan: "Compléter le bilan",
  commissions: "Voir les commissions",
};

// Icône Lucide par type de livrable
const KIND_ICON: Record<DeliverableKind, typeof FileText> = {
  task: ListChecks,
  document: FileText,
  stakeholder: Users,
  financing: Wallet,
  milestone: Flag,
  field: PencilLine,
  identity: FileText,
};

// Libellé en clair par type, pour le badge
const KIND_LABEL: Record<DeliverableKind, string> = {
  task: "Tâche",
  document: "Document",
  stakeholder: "Partie prenante",
  financing: "Financement",
  milestone: "Jalon",
  field: "À remplir",
  identity: "Identité",
};

export default function PhaseGuide({
  projectId,
  currentPhase,
  initialProgress,
  resourceCounts,
  canEdit,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProjectPhase>(currentPhase);
  const [progress, setProgress] = useState<ProgressMap>(initialProgress || {});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const currentIdx = PROJECT_PHASES.indexOf(currentPhase);
  const selectedIdx = PROJECT_PHASES.indexOf(selected);
  const guide = PROJECT_PHASE_GUIDE[selected];

  const status: "done" | "current" | "future" =
    selectedIdx < currentIdx
      ? "done"
      : selectedIdx === currentIdx
      ? "current"
      : "future";

  /** Détecte si un livrable est « rempli » :
   *  - auto via ressourceCounts pour les types liés
   *  - via phase_progress pour task/field
   */
  function isDeliverableDone(phase: ProjectPhase, idx: number, spec: DeliverableSpec): boolean {
    if (spec.kind === "document") return resourceCounts.documents > 0 || hasManualDone(phase, idx);
    if (spec.kind === "stakeholder") return resourceCounts.stakeholders > 0 || hasManualDone(phase, idx);
    if (spec.kind === "financing") return resourceCounts.financings > 0 || hasManualDone(phase, idx);
    if (spec.kind === "milestone") return resourceCounts.milestones > 0 || hasManualDone(phase, idx);
    return hasManualDone(phase, idx);
  }
  function hasManualDone(phase: ProjectPhase, idx: number): boolean {
    return progress[phase]?.[String(idx)]?.done === true;
  }

  const phaseData = progress[selected] ?? {};
  const total = guide.deliverables.length;
  const checkedCount = guide.deliverables.reduce(
    (n, spec, i) => (isDeliverableDone(selected, i, spec) ? n + 1 : n),
    0,
  );
  const pctDone = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

  async function persistProgress(next: ProgressMap) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase_progress: next }),
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  async function toggleDeliverable(phase: ProjectPhase, idx: number) {
    if (!canEdit) return;
    const key = `${phase}:${idx}`;
    setSavingKey(key);
    const phaseObj = { ...(progress[phase] ?? {}) };
    const cur = phaseObj[String(idx)] ?? { done: false, note: null };
    phaseObj[String(idx)] = { ...cur, done: !cur.done };
    const next = { ...progress, [phase]: phaseObj };
    setProgress(next);
    try {
      await persistProgress(next);
    } finally {
      setSavingKey(null);
    }
  }

  async function saveNote(phase: ProjectPhase, idx: number, note: string) {
    if (!canEdit) return;
    const phaseObj = { ...(progress[phase] ?? {}) };
    const cur = phaseObj[String(idx)] ?? { done: false, note: null };
    phaseObj[String(idx)] = { ...cur, note: note.trim() || null };
    const next = { ...progress, [phase]: phaseObj };
    setProgress(next);
    await persistProgress(next);
  }

  return (
    <div className="pj-phase-guide">
      {/* Mini-stepper cliquable */}
      <div className="pj-phase-guide-strip" role="tablist" aria-label="Étapes du projet">
        {PROJECT_PHASES.map((phase, i) => {
          const isSelected = phase === selected;
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const ptotal = PROJECT_PHASE_GUIDE[phase].deliverables.length;
          const pchecked = PROJECT_PHASE_GUIDE[phase].deliverables.reduce(
            (n, spec, ii) => (isDeliverableDone(phase, ii, spec) ? n + 1 : n),
            0,
          );
          return (
            <button
              key={phase}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`pj-phase-guide-pill${isSelected ? " is-selected" : ""}${
                isDone ? " is-done" : ""
              }${isCurrent ? " is-current" : ""}`}
              onClick={() => setSelected(phase)}
            >
              <span className="pj-phase-guide-pill-icon" aria-hidden>
                {isDone ? (
                  <CheckCircle2 size={13} />
                ) : isCurrent ? (
                  <span className="pj-phase-guide-pill-pulse" />
                ) : (
                  <Circle size={13} />
                )}
              </span>
              <span className="pj-phase-guide-pill-num">{i + 1}</span>
              <span className="pj-phase-guide-pill-label">
                {PROJECT_PHASE_LABELS[phase]}
              </span>
              {ptotal > 0 && (
                <span className="pj-phase-guide-pill-progress" aria-hidden>
                  {pchecked}/{ptotal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panneau narration + livrables */}
      <div className="pj-phase-guide-panel">
        <header className="pj-phase-guide-head">
          <div className="pj-phase-guide-icon" aria-hidden>
            <PhaseIcon phase={selected} size={20} strokeWidth={1.8} />
          </div>
          <div className="pj-phase-guide-title-block">
            <span className="pj-phase-guide-eyebrow">
              {status === "current" && "Étape actuelle"}
              {status === "done" && "Étape franchie"}
              {status === "future" && "Étape à venir"}{" "}
              · {selectedIdx + 1} sur {PROJECT_PHASES.length}
            </span>
            <h3 className="pj-phase-guide-title">{PROJECT_PHASE_LABELS[selected]}</h3>
          </div>
          {total > 0 && (
            <div className="pj-phase-guide-progress" title={`${checkedCount}/${total} livrables`}>
              <span className="pj-phase-guide-progress-num">{pctDone}%</span>
              <div className="pj-phase-guide-progress-bar" aria-hidden>
                <div
                  className="pj-phase-guide-progress-fill"
                  style={{ width: `${pctDone}%` }}
                />
              </div>
            </div>
          )}
        </header>

        <div className="pj-phase-guide-grid">
          <div className="pj-phase-guide-block">
            <div className="pj-phase-guide-block-label">
              <MapPin size={12} aria-hidden />
              <span>Vous arrivez avec</span>
            </div>
            <p className="pj-phase-guide-block-text">{guide.arrivedWith}</p>
          </div>
          <div className="pj-phase-guide-block">
            <div className="pj-phase-guide-block-label">
              <Target size={12} aria-hidden />
              <span>C&apos;est quoi cette étape</span>
            </div>
            <p className="pj-phase-guide-block-text">{guide.objective}</p>
          </div>
        </div>

        {/* Livrables actionnables */}
        <div className="pj-phase-guide-block">
          <div className="pj-phase-guide-block-label">
            <CheckCircle2 size={12} aria-hidden />
            <span>
              Livrables à produire ({checkedCount}/{total})
            </span>
          </div>
          <ul className="pj-phase-guide-deliverables">
            {guide.deliverables.map((spec, idx) => {
              const manual = phaseData[String(idx)] ?? { done: false, note: null };
              const auto = spec.kind !== "task" && spec.kind !== "field" &&
                (
                  (spec.kind === "document" && resourceCounts.documents > 0) ||
                  (spec.kind === "stakeholder" && resourceCounts.stakeholders > 0) ||
                  (spec.kind === "financing" && resourceCounts.financings > 0) ||
                  (spec.kind === "milestone" && resourceCounts.milestones > 0)
                );
              const done = auto || manual.done;
              const isManualKind = spec.kind === "task" || spec.kind === "field";
              const key = `${selected}:${idx}`;
              const isSaving = savingKey === key;
              const Icon = KIND_ICON[spec.kind];

              return (
                <li
                  key={idx}
                  className={`pj-phase-deliverable${done ? " is-done" : ""}`}
                >
                  <button
                    type="button"
                    className="pj-phase-deliverable-check"
                    onClick={() => isManualKind && toggleDeliverable(selected, idx)}
                    disabled={!canEdit || isSaving || (auto && !isManualKind)}
                    aria-label={
                      done
                        ? "Marquer comme à faire"
                        : "Marquer comme fait"
                    }
                    title={
                      auto && !isManualKind
                        ? "Auto-coché : ressource présente dans la fiche projet"
                        : undefined
                    }
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="spin" />
                    ) : done ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </button>
                  <div className="pj-phase-deliverable-body">
                    <div className="pj-phase-deliverable-line">
                      <span className="pj-phase-deliverable-kind" aria-hidden>
                        <Icon size={10} />
                        {KIND_LABEL[spec.kind]}
                      </span>
                      <span className="pj-phase-deliverable-label">{spec.label}</span>
                    </div>
                    {/* Note libre pour les types manuels */}
                    {isManualKind && canEdit ? (
                      <NoteInput
                        defaultValue={manual.note ?? ""}
                        onSave={(v) => saveNote(selected, idx, v)}
                        placeholder="Note, référence, n° de délibération…"
                      />
                    ) : manual.note ? (
                      <span className="pj-phase-deliverable-note">{manual.note}</span>
                    ) : null}
                    {/* CTA vers la fiche projet pour les types liés */}
                    {spec.link && (
                      <a
                        href={`?tab=fiche#${LINK_ANCHOR[spec.link]}`}
                        className="pj-phase-deliverable-cta"
                      >
                        {done && !isManualKind ? "Voir / compléter" : LINK_CTA_LABEL[spec.link]}
                        <ArrowRight size={11} aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Porte vers la suite */}
        <div className="pj-phase-guide-gate">
          <div className="pj-phase-guide-gate-icon" aria-hidden>
            <Lock size={14} />
          </div>
          <div>
            <div className="pj-phase-guide-gate-label">Et après ?</div>
            <p className="pj-phase-guide-gate-text">
              {guide.gate}
              {selectedIdx < PROJECT_PHASES.length - 1 && (
                <>
                  {" "}
                  <ArrowRight size={11} aria-hidden style={{ verticalAlign: -1 }} />{" "}
                  <strong>
                    {PROJECT_PHASE_LABELS[PROJECT_PHASES[selectedIdx + 1]]}
                  </strong>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteInput({
  defaultValue,
  onSave,
  placeholder,
}: {
  defaultValue: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      type="text"
      className="pj-phase-deliverable-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim() !== (defaultValue ?? "").trim()) onSave(value);
      }}
      placeholder={placeholder}
    />
  );
}

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
} from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
} from "@/lib/projects/types";
import PhaseIcon from "./PhaseIcon";

// ═══════════════════════════════════════════════════════════════
// PhaseGuide — panneau de contexte + check-list ACTIONNABLE par
// phase. Affiché sous le stepper.
//
// Chaque livrable-type de PROJECT_PHASE_GUIDE devient une case à
// cocher persistée dans projects.phase_progress (jsonb). L'utilisateur
// peut aussi joindre une note libre (référence à un document,
// décision, échéance…). Le pourcentage d'avancement de la phase est
// calculé en direct et sert d'aide visuelle pour décider du passage
// à la phase suivante.
// ═══════════════════════════════════════════════════════════════

type ProgressMap = Record<
  string,
  Record<string, { done: boolean; note: string | null }>
>;

interface Props {
  projectId: string;
  currentPhase: ProjectPhase;
  initialProgress: ProgressMap;
  canEdit: boolean;
}

export default function PhaseGuide({
  projectId,
  currentPhase,
  initialProgress,
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
    selectedIdx < currentIdx ? "done" : selectedIdx === currentIdx ? "current" : "future";

  const phaseData = progress[selected] ?? {};
  const total = guide.deliverables.length;
  const checkedCount = guide.deliverables.reduce(
    (n, _, i) => (phaseData[String(i)]?.done ? n + 1 : n),
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
          const ph = progress[phase] ?? {};
          const ptotal = PROJECT_PHASE_GUIDE[phase].deliverables.length;
          const pchecked = PROJECT_PHASE_GUIDE[phase].deliverables.reduce(
            (n, _, ii) => (ph[String(ii)]?.done ? n + 1 : n),
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

      {/* Panneau narration + checklist */}
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

        {/* Check-list actionnable */}
        <div className="pj-phase-guide-block">
          <div className="pj-phase-guide-block-label">
            <CheckCircle2 size={12} aria-hidden />
            <span>
              Livrables à produire ({checkedCount}/{total})
            </span>
          </div>
          <ul className="pj-phase-guide-deliverables">
            {guide.deliverables.map((label, idx) => {
              const item = phaseData[String(idx)] ?? { done: false, note: null };
              const key = `${selected}:${idx}`;
              const isSaving = savingKey === key;
              return (
                <li
                  key={idx}
                  className={`pj-phase-deliverable${item.done ? " is-done" : ""}`}
                >
                  <button
                    type="button"
                    className="pj-phase-deliverable-check"
                    onClick={() => toggleDeliverable(selected, idx)}
                    disabled={!canEdit || isSaving}
                    aria-label={item.done ? "Marquer comme à faire" : "Marquer comme fait"}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="spin" />
                    ) : item.done ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </button>
                  <div className="pj-phase-deliverable-body">
                    <span className="pj-phase-deliverable-label">{label}</span>
                    {canEdit ? (
                      <NoteInput
                        defaultValue={item.note ?? ""}
                        onSave={(v) => saveNote(selected, idx, v)}
                        placeholder="Note, référence document, n° de délibération…"
                      />
                    ) : (
                      item.note && (
                        <span className="pj-phase-deliverable-note">{item.note}</span>
                      )
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

// ─── Petit input note avec save sur blur ───
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

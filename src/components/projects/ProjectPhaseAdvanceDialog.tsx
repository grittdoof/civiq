"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, AlertTriangle, Loader2 } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  type AdvanceResult,
  type ProjectPhase,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// ProjectPhaseAdvanceDialog — Faire avancer / reculer / forcer
// la transition d'étape d'un projet. La RPC SQL est source
// d'autorité ; ici on ne fait que collecter les inputs.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  currentPhase: ProjectPhase;
  /** L'utilisateur courant est admin (peut forcer un saut) */
  isAdmin: boolean;
}

export default function ProjectPhaseAdvanceDialog({ projectId, currentPhase, isAdmin }: Props) {
  const router = useRouter();
  const currentIdx = PROJECT_PHASES.indexOf(currentPhase);
  const nextPhase = currentIdx < PROJECT_PHASES.length - 1 ? PROJECT_PHASES[currentIdx + 1] : null;
  const prevPhase = currentIdx > 0 ? PROJECT_PHASES[currentIdx - 1] : null;

  const [open, setOpen] = useState(false);
  const [targetPhase, setTargetPhase] = useState<ProjectPhase | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvanceResult | null>(null);

  function startTransition(target: ProjectPhase) {
    setTargetPhase(target);
    setCommentaire("");
    setForce(false);
    setResult(null);
    setOpen(true);
  }

  async function submit() {
    if (!targetPhase) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_phase: targetPhase,
          commentaire: commentaire.trim() || null,
          force,
        }),
      });
      const data = (await res.json()) as AdvanceResult & { error?: string };
      if (data.error) {
        setResult({ ok: false, reason: data.error, warnings: [], require_comment: false, require_force: false });
      } else {
        setResult(data);
        if (data.ok) {
          setTimeout(() => {
            setOpen(false);
            router.refresh();
          }, 1500);
        }
      }
    } catch (e) {
      setResult({
        ok: false,
        reason: e instanceof Error ? e.message : "Erreur réseau",
        warnings: [],
        require_comment: false,
        require_force: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="pj-advance-actions">
        {prevPhase && (
          <button
            type="button"
            onClick={() => startTransition(prevPhase)}
            className="civiq-btn civiq-btn-outline"
          >
            <ChevronLeft size={14} /> Reculer à « {PROJECT_PHASE_LABELS[prevPhase]} »
          </button>
        )}
        {nextPhase && (
          <button
            type="button"
            onClick={() => startTransition(nextPhase)}
            className="civiq-btn civiq-btn-default"
          >
            Faire avancer vers « {PROJECT_PHASE_LABELS[nextPhase]} » <ChevronRight size={14} />
          </button>
        )}
      </div>

      {open && targetPhase && (
        <div className="pj-modal-backdrop" onClick={() => !loading && setOpen(false)}>
          <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pj-modal-title">
              Transition : {PROJECT_PHASE_LABELS[currentPhase]} → {PROJECT_PHASE_LABELS[targetPhase]}
            </h3>

            <div className="pj-modal-body">
              <label className="civiq-field-label">Commentaire</label>
              <textarea
                rows={3}
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Motif de la transition (obligatoire en cas de recul ou forçage)"
                className="pj-input"
              />

              {isAdmin && (
                <label className="pj-checkbox">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                  />
                  <span>Forcer (saut d&apos;étape — réservé administrateurs)</span>
                </label>
              )}

              {result && !result.ok && (
                <div className="pj-modal-error">
                  <AlertTriangle size={14} /> {result.reason}
                </div>
              )}
              {result?.ok && (
                <div className="pj-modal-success">
                  ✓ Transition effectuée.
                  {result.warnings && result.warnings.length > 0 && (
                    <ul className="pj-modal-warnings">
                      {result.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="pj-modal-footer">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="civiq-btn civiq-btn-ghost"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading || result?.ok}
                className="civiq-btn civiq-btn-default"
              >
                {loading ? <Loader2 className="spin" size={14} /> : null}
                Confirmer la transition
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

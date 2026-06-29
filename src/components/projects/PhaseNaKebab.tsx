"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, MinusCircle, RotateCcw, Loader2, X } from "lucide-react";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// PhaseNaKebab — kebab discret en haut de la page de phase qui
// permet de marquer une phase entière « non applicable » avec un
// motif court. Une phase NA sort du calcul de progression et sa
// traversée n'est pas considérée comme un saut.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  phase: ProjectPhase;
  currentMotif: string | null;
  canEdit: boolean;
  /** Permet de désactiver le bouton sur la phase courante du projet. */
  isCurrentPhase: boolean;
}

export default function PhaseNaKebab({
  projectId,
  phase,
  currentMotif,
  canEdit,
  isCurrentPhase,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "motif">("menu");
  const [motif, setMotif] = useState(currentMotif ?? "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isNA = currentMotif !== null;

  if (!canEdit) return null;

  async function applyChange(action: "set" | "unset") {
    if (saving) return;
    setSaving(true);
    try {
      // 1. Lire l'état courant phase_not_applicable
      const r = await fetch(`/api/projects/${projectId}`);
      if (!r.ok) { setSaving(false); return; }
      const data = (await r.json()) as {
        project?: { phase_not_applicable?: Record<string, string> };
      };
      const next = { ...(data.project?.phase_not_applicable ?? {}) };
      if (action === "set") {
        next[phase] = motif.trim() || "Non applicable";
      } else {
        delete next[phase];
      }
      const p = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase_not_applicable: next }),
      });
      if (!p.ok) { setSaving(false); return; }
      setOpen(false);
      setMode("menu");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pj-phase-kebab">
      <button
        type="button"
        className="pj-phase-kebab-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions sur cette phase"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="pj-phase-kebab-menu" role="menu">
          {mode === "menu" && (
            <>
              {isNA ? (
                <button
                  type="button"
                  className="pj-phase-kebab-item"
                  onClick={() => applyChange("unset")}
                  disabled={saving}
                >
                  <RotateCcw size={13} />
                  <span>Rétablir cette phase</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="pj-phase-kebab-item"
                  onClick={() => setMode("motif")}
                  disabled={saving || isCurrentPhase}
                  title={isCurrentPhase ? "Vous êtes actuellement sur cette phase" : undefined}
                >
                  <MinusCircle size={13} />
                  <span>Marquer non applicable</span>
                </button>
              )}
              {isNA && (
                <p className="pj-phase-kebab-motif-current">
                  Motif : {currentMotif}
                </p>
              )}
            </>
          )}
          {mode === "motif" && (
            <div className="pj-phase-kebab-form">
              <label className="civiq-field-label" htmlFor="phase-na-motif">
                Motif court
              </label>
              <input
                id="phase-na-motif"
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="civiq-input"
                placeholder="Ex. : compétence intercommunale, sans objet ici"
                autoFocus
              />
              <div className="pj-phase-kebab-form-actions">
                <button
                  type="button"
                  className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                  onClick={() => setMode("menu")}
                  disabled={saving}
                >
                  <X size={13} /> Annuler
                </button>
                <button
                  type="button"
                  className="civiq-btn civiq-btn-sm"
                  onClick={() => applyChange("set")}
                  disabled={saving}
                >
                  {saving ? <><Loader2 size={12} className="spin" /> Enregistrement…</> : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

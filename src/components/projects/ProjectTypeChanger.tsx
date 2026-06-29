"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb, PartyPopper, ListChecks, ChevronDown, Loader2, AlertTriangle,
} from "lucide-react";
import {
  PROJECT_TYPE_META,
  PROJECT_TYPE_LABELS,
  type ProjectType,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// ProjectTypeChanger — petit menu kebab discret pour changer le
// gabarit d'un projet existant. Brief : « il reste modifiable
// (avec un message les phases vont être recalculées) ».
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  currentType: ProjectType;
  canEdit: boolean;
}

const ICONS: Record<ProjectType, typeof Lightbulb> = {
  investment: Lightbulb,
  event: PartyPopper,
  tracking: ListChecks,
};

export default function ProjectTypeChanger({ projectId, currentType, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState<ProjectType | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const CurrentIcon = ICONS[currentType];

  async function apply(target: ProjectType) {
    if (saving || target === currentType) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: target }),
      });
      if (!r.ok) {
        setSaving(false);
        return;
      }
      setOpen(false);
      setConfirmFor(null);
      startTransition(() => router.refresh());
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="pj-type-changer">
      <button
        type="button"
        className="pj-type-changer-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={!canEdit}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon size={14} />
        <span>Type : {PROJECT_TYPE_LABELS[currentType]}</span>
        {canEdit && <ChevronDown size={13} />}
      </button>

      {open && canEdit && (
        <div className="pj-type-changer-menu" role="menu">
          {confirmFor === null ? (
            <>
              <p className="pj-type-changer-help">Changer de gabarit ?</p>
              {(Object.keys(PROJECT_TYPE_META) as ProjectType[]).map((t) => {
                const meta = PROJECT_TYPE_META[t];
                const Icon = ICONS[t];
                const isCurrent = t === currentType;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`pj-type-changer-item${isCurrent ? " is-current" : ""}`}
                    onClick={() => !isCurrent && setConfirmFor(t)}
                    disabled={isCurrent || saving}
                  >
                    <Icon size={14} />
                    <span className="pj-type-changer-item-text">
                      <strong>{meta.label}</strong>
                      <em>{meta.tagline}</em>
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="pj-type-changer-confirm">
              <div className="pj-type-changer-confirm-head">
                <AlertTriangle size={14} />
                <strong>Confirmer le changement</strong>
              </div>
              <p>
                Vous passez de <strong>{PROJECT_TYPE_LABELS[currentType]}</strong>{" "}
                à <strong>{PROJECT_TYPE_LABELS[confirmFor]}</strong>.
              </p>
              <p className="pj-type-changer-warn">
                Les phases vont être recalculées sur le nouveau gabarit. La phase
                actuelle sera remplacée par la première phase du nouveau gabarit
                si elle n'existe pas. Les progressions saisies sur des phases
                d'un autre gabarit restent en base mais ne s'affichent plus.
              </p>
              <div className="pj-type-changer-confirm-actions">
                <button
                  type="button"
                  className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                  onClick={() => setConfirmFor(null)}
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="civiq-btn civiq-btn-sm"
                  onClick={() => apply(confirmFor)}
                  disabled={saving}
                >
                  {saving ? <><Loader2 size={12} className="spin" /> Recalcul…</> : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

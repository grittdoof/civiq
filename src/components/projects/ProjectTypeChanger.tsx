"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import type { TypeProjetCode } from "@/lib/projects/types";
import type { Alerte } from "@/lib/projects/type-change";
import { TYPE_META } from "./TypeBadge";
import AlerteBlock from "./AlerteBlock";

// ═══════════════════════════════════════════════════════════════
// Changement de type d'un projet. Les règles sont appliquées côté
// serveur (POST /api/projects/:id/type) : refus structuré si des
// données financières seraient masquées, confirmation si le budget
// change de section.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  currentType: TypeProjetCode;
  canEdit: boolean;
}

const TYPES: TypeProjetCode[] = ["investissement", "evenementiel", "suivi_simple"];

export default function ProjectTypeChanger({ projectId, currentType, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<TypeProjetCode | null>(null);
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  const [avertissement, setAvertissement] = useState<Alerte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const Current = TYPE_META[currentType];

  function reset() {
    setTarget(null);
    setAlerte(null);
    setAvertissement(null);
    setError(null);
  }

  async function apply(to: TypeProjetCode, confirmer = false) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_code: to, confirmer }),
      });
      const json = await r.json().catch(() => ({}));
      if (r.status === 409 && json.alerte) {
        setAlerte(json.alerte);
      } else if (r.status === 409 && json.avertissement) {
        setAvertissement(json.avertissement);
      } else if (!r.ok) {
        setError(json.error ?? "Le changement a échoué.");
      } else {
        setOpen(false);
        reset();
        startTransition(() => router.refresh());
      }
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pj-type-changer">
      <button
        type="button"
        className="pj-type-changer-btn"
        onClick={() => { setOpen((o) => !o); reset(); }}
        disabled={!canEdit}
        aria-expanded={open}
      >
        <Current.Icon size={14} aria-hidden="true" />
        <span>Type : {Current.label}</span>
        {canEdit && <ChevronDown size={13} aria-hidden="true" />}
      </button>

      {open && canEdit && (
        <div className="pj-type-changer-menu">
          {!target ? (
            <>
              <p className="pj-type-changer-help">Changer de type ? Rien n&apos;est perdu.</p>
              {TYPES.map((t) => {
                const meta = TYPE_META[t];
                const isCurrent = t === currentType;
                return (
                  <button
                    key={t}
                    type="button"
                    className={`pj-type-changer-item${isCurrent ? " is-current" : ""}`}
                    onClick={() => { setTarget(t); void apply(t); }}
                    disabled={isCurrent || saving}
                    aria-current={isCurrent ? "true" : undefined}
                  >
                    <meta.Icon size={14} aria-hidden="true" />
                    <span className="pj-type-changer-item-text">
                      <strong>{meta.label}</strong>
                      {isCurrent ? <em>Type actuel</em> : null}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <div className="pj-type-changer-confirm">
              {saving && !alerte && !avertissement && (
                <p><Loader2 size={12} className="civiq-spin" aria-hidden="true" /> Vérification…</p>
              )}
              {alerte && <AlerteBlock alerte={alerte} registre="obligatoire" role="alert" />}
              {avertissement && <AlerteBlock alerte={avertissement} registre="recommande" />}
              {error && <p className="pj-modal-error" role="alert">{error}</p>}
              <div className="pj-type-changer-confirm-actions">
                <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={reset} disabled={saving}>
                  {alerte ? "Fermer" : "Annuler"}
                </button>
                {avertissement && (
                  <button type="button" className="civiq-btn civiq-btn-sm" onClick={() => apply(target, true)} disabled={saving}>
                    {saving ? <Loader2 size={12} className="civiq-spin" aria-hidden="true" /> : null}
                    Changer en {TYPE_META[target].label.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

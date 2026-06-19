"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2, X } from "lucide-react";

interface Props {
  projectId: string;
  projectTitle: string;
}

// ═══════════════════════════════════════════════════════════════
// Suppression définitive d'un projet — super-admin uniquement.
//
// UX :
//   - bouton discret "Supprimer" (ghost rouge) dans le header
//   - confirm modal qui exige de RETAPER le titre du projet
//     (high-friction délibéré : impossible de supprimer par
//      réflexe ou erreur de clic)
//   - retour visuel : shake si la confirmation ne correspond pas,
//     spinner pendant la requête, redirect vers la liste au succès
// ═══════════════════════════════════════════════════════════════

export default function DeleteProjectButton({ projectId, projectTitle }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus auto sur l'input + fermeture Échap
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, submitting]);

  function close() {
    setOpen(false);
    setConfirmText("");
    setError(null);
    setShake(false);
  }

  const expected = projectTitle.trim();
  const matches = confirmText.trim() === expected;

  async function handleDelete() {
    if (!matches) {
      setShake(true);
      setTimeout(() => setShake(false), 380);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Erreur ${res.status}`);
        setSubmitting(false);
        return;
      }
      // Succès : on quitte la page
      router.push("/admin/projects");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="civiq-btn civiq-btn-outline pj-delete-trigger"
        onClick={() => setOpen(true)}
        title="Supprimer ce projet (super-administrateur)"
      >
        <Trash2 size={14} /> Supprimer
      </button>

      {open && (
        <div
          className="pj-delete-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) close();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pj-delete-title"
        >
          <div className={`pj-delete-modal${shake ? " is-shake" : ""}`}>
            <button
              type="button"
              className="pj-delete-close"
              onClick={close}
              disabled={submitting}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <div className="pj-delete-icon">
              <AlertTriangle size={28} />
            </div>

            <h2 id="pj-delete-title" className="pj-delete-title">
              Supprimer définitivement ce projet ?
            </h2>
            <p className="pj-delete-desc">
              Cette action est <strong>irréversible</strong>. Tous les financements,
              jalons, parties prenantes, documents et l&apos;historique des phases
              seront supprimés. Les ressources liées (tickets d&apos;origine, sessions
              de commission) resteront mais perdront le lien vers ce projet.
            </p>

            <label className="pj-delete-label" htmlFor="pj-delete-input">
              Tapez exactement le titre du projet pour confirmer :
              <code className="pj-delete-expected">{expected}</code>
            </label>
            <input
              ref={inputRef}
              id="pj-delete-input"
              type="text"
              className="pj-delete-input"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              placeholder="Tapez le titre exact ici"
              disabled={submitting}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            {error && <p className="pj-delete-error">⚠ {error}</p>}

            <div className="pj-delete-actions">
              <button
                type="button"
                className="civiq-btn civiq-btn-ghost"
                onClick={close}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className="civiq-btn pj-delete-confirm"
                onClick={handleDelete}
                disabled={!matches || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="spin" /> Suppression…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmer la suppression
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

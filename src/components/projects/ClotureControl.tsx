"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, RotateCcw } from "lucide-react";

// Clôture d'un dossier terminé : il sort des projets ouverts, de
// l'agenda et des alertes, reste consultable et peut être rouvert.

interface Props {
  projectId: string;
  titre: string;
  clos: boolean;
  /** Étapes pas encore terminées (avertissement avant clôture). */
  etapesOuvertes: number;
}

export default function ClotureControl({ projectId, titre, clos, etapesOuvertes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bilan, setBilan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "clore" | "rouvrir") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/cloture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "clore" ? { action, bilan } : { action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "La modification n'a pas été enregistrée.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La modification n'a pas été enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  if (clos) {
    return (
      <>
        <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={() => send("rouvrir")} disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />} Rouvrir le projet
        </button>
        {error && <p className="pj-modal-error" role="alert">{error}</p>}
      </>
    );
  }

  if (!open) {
    return (
      <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={() => setOpen(true)}>
        <Archive size={14} aria-hidden="true" /> Clôturer le projet
      </button>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send("clore");
  }

  return (
    <form className="pj-confidentiel-form" onSubmit={submit}>
      <p className="pj-params-intro">
        <strong>« {titre} »</strong> sortira des projets ouverts, de l&apos;agenda et des alertes. Il reste consultable
        (filtre « Clôturés ») et peut être rouvert à tout moment.
      </p>
      {etapesOuvertes > 0 && (
        <p className="pj-alerte pj-alerte-recommande" role="note">
          {etapesOuvertes === 1 ? "1 étape n'est pas terminée" : `${etapesOuvertes} étapes ne sont pas terminées`} :
          elles resteront en l&apos;état.
        </p>
      )}
      <div className="civiq-field">
        <label htmlFor="cloture-bilan" className="civiq-field-label">Bilan (facultatif)</label>
        <textarea id="cloture-bilan" className="civiq-textarea" rows={3} maxLength={2000} value={bilan}
          placeholder="Ex. travaux réceptionnés le 12 juin, budget respecté" onChange={(e) => setBilan(e.target.value)} />
      </div>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-wiz-inline">
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />} Clôturer
        </button>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

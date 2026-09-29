"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LockOpen } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Marquer / démarquer un projet confidentiel (brief §2.10).
// Réservé au bureau municipal (administrateurs) : le serveur refuse
// sinon. Le motif est demandé pour tracer la décision.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  confidentiel: boolean;
}

export default function ConfidentielControl({ projectId, confidentiel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function envoyer(on: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidentiel: on, confidentiel_motif: on ? motif : null }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "La modification a échoué."); return; }
    setOpen(false);
    setMotif("");
    router.refresh();
  }

  if (confidentiel) {
    return (
      <>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" disabled={busy}
          onClick={() => window.confirm("Retirer la confidentialité ? Le projet redeviendra visible de tous les élus et agents de la commune, dans la liste, le calendrier et les agendas.") && envoyer(false)}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />} Retirer la confidentialité
        </button>
        {error && <p className="pj-modal-error" role="alert">{error}</p>}
      </>
    );
  }

  if (!open) {
    return (
      <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(true)}>
        <Lock size={14} aria-hidden="true" /> Rendre confidentiel
      </button>
    );
  }

  return (
    <form className="pj-confidentiel-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void envoyer(true); }}>
      <p className="pj-params-intro">
        Le projet ne sera plus visible que du bureau municipal (administrateurs) et des personnes qui le portent :
        élu référent, agent, participants. Il disparaît de la liste, du calendrier, des agendas et des notifications
        des autres élus.
      </p>
      <div className="civiq-field">
        <label htmlFor="conf-motif" className="civiq-field-label">
          Pourquoi ?<span className="civiq-required" aria-hidden="true"> *</span>
        </label>
        <input id="conf-motif" className="civiq-input" required value={motif} maxLength={300}
          placeholder="Ex. négociation foncière en cours" onChange={(e) => setMotif(e.target.value)} />
      </div>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-wiz-inline">
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy || !motif.trim()}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />} Rendre confidentiel
        </button>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

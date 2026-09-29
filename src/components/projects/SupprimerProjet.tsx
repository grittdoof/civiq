"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

// Mise à la corbeille d'un projet : motif obligatoire, sauvegarde JSON
// côté serveur, restauration possible pendant 30 jours (super-admin).

export default function SupprimerProjet({ projectId, titre }: { projectId: string; titre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "La suppression a échoué."); return; }
    router.push("/admin/projects?supprime=1");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm pj-agenda-danger" onClick={() => setOpen(true)}>
        <Trash2 size={14} aria-hidden="true" /> Supprimer le projet
      </button>
    );
  }
  return (
    <form className="pj-confidentiel-form" onSubmit={submit}>
      <p className="pj-params-intro">
        <strong>« {titre} »</strong> va disparaître de la liste, du calendrier et des agendas. Une sauvegarde complète est
        conservée : le projet peut être restauré pendant 30 jours en le demandant au support GoCiviq (super-administrateur).
        Passé ce délai, il est supprimé définitivement.
      </p>
      <div className="civiq-field">
        <label htmlFor="suppr-motif" className="civiq-field-label">Pourquoi ?<span className="civiq-required" aria-hidden="true"> *</span></label>
        <input id="suppr-motif" className="civiq-input" required maxLength={300} value={motif}
          placeholder="Ex. doublon, projet abandonné par le conseil" onChange={(e) => setMotif(e.target.value)} />
      </div>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-wiz-inline">
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm pj-btn-danger" disabled={busy || !motif.trim()}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} Mettre à la corbeille
        </button>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

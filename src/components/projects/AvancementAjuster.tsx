"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";

// Surcharge manuelle de l'avancement (brief §2.6) : pourcentage + motif
// obligatoire ; auteur et date tracés côté serveur (+ journal d'audit).

interface Props {
  projectId: string;
  manuelPct: number | null;
  motif: string | null;
  autoPct: number | null;
}

export default function AvancementAjuster({ projectId, manuelPct, motif, autoPct }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(manuelPct === null ? String(autoPct ?? "") : String(manuelPct));
  const [texte, setTexte] = useState(motif ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "L'enregistrement a échoué.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'enregistrement a échoué.");
    } finally {
      setBusy(false);
    }
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    void send({ avancement_manuel_pct: Number(pct), avancement_manuel_motif: texte });
  }

  if (!open) {
    return (
      <button type="button" className="pj-link-btn" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={12} aria-hidden="true" /> Ajuster
      </button>
    );
  }

  return (
    <form className="pj-avancement-form" onSubmit={submit}>
      <p className="civiq-field-hint">
        Calculé automatiquement : {autoPct === null ? "non renseigné (aucune étape clé)" : `${Math.round(autoPct)} %`}.
        Ajustez seulement si ce calcul ne reflète pas la réalité.
      </p>
      <div className="civiq-field">
        <label htmlFor="av-pct" className="civiq-field-label">Avancement réel, en %</label>
        <input id="av-pct" className="civiq-input" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d]/g, ""))} required />
      </div>
      <div className="civiq-field">
        <label htmlFor="av-motif" className="civiq-field-label">Pourquoi ? (une phrase)</label>
        <input id="av-motif" className="civiq-input" value={texte} onChange={(e) => setTexte(e.target.value)} required maxLength={500} />
      </div>
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-wiz-inline">
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : null} Enregistrer
        </button>
        {manuelPct !== null && (
          <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" disabled={busy}
            onClick={() => send({ avancement_manuel_pct: null })}>
            Revenir au calcul automatique
          </button>
        )}
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

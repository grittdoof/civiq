"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { wallClockIso } from "@/lib/projects/wizard";

// Dates clés modifiables après la création (y compris pour les projets
// créés avant l'assistant) :
//   investissement : échéance souhaitée — sert à l'alerte de campagne ;
//   événement      : date, heures, lieu — servent au rétroplanning.

interface Props {
  projectId: string;
  type: "investissement" | "evenementiel";
  echeance: string | null;
  debut: string | null;
  fin: string | null;
  lieu: string | null;
}

export default function ProjectDatesEditor({ projectId, type, echeance, debut, fin, lieu }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [e, setE] = useState(echeance ?? "");
  const [d, setD] = useState(debut?.slice(0, 10) ?? "");
  const [h1, setH1] = useState(debut && !debut.includes("T00:00:00") ? debut.slice(11, 16) : "");
  const [h2, setH2] = useState(fin ? fin.slice(11, 16) : "");
  const [l, setL] = useState(lieu ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const body = type === "investissement"
      ? { echeance_souhaitee: e || null }
      : { evenement_debut: d ? wallClockIso(d, h1) : null, evenement_fin: d && h2 ? wallClockIso(d, h2) : null, lieu: l || null };
    const res = await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "L'enregistrement a échoué."); return; }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="pj-link-btn" onClick={() => setOpen(true)}>
        <CalendarDays size={12} aria-hidden="true" /> {type === "investissement" ? "Modifier l'échéance" : "Modifier la date et le lieu"}
      </button>
    );
  }
  return (
    <form className="pj-avancement-form" onSubmit={submit}>
      {type === "investissement" ? (
        <div className="civiq-field">
          <label htmlFor="dt-ech" className="civiq-field-label">Échéance souhaitée</label>
          <p id="dt-ech-hint" className="civiq-field-hint">Sert à vous prévenir à temps de la campagne de subventions de l&apos;année précédente.</p>
          <input id="dt-ech" type="date" className="civiq-input" value={e} onChange={(x) => setE(x.target.value)} aria-describedby="dt-ech-hint" />
        </div>
      ) : (
        <>
          <div className="civiq-field">
            <label htmlFor="dt-d" className="civiq-field-label">Date de l&apos;événement</label>
            <input id="dt-d" type="date" className="civiq-input" value={d} onChange={(x) => setD(x.target.value)} />
          </div>
          <div className="pj-wiz-row">
            <div className="civiq-field">
              <label htmlFor="dt-h1" className="civiq-field-label">Début</label>
              <input id="dt-h1" type="time" className="civiq-input" value={h1} onChange={(x) => setH1(x.target.value)} disabled={!d} />
            </div>
            <div className="civiq-field">
              <label htmlFor="dt-h2" className="civiq-field-label">Fin</label>
              <input id="dt-h2" type="time" className="civiq-input" value={h2} onChange={(x) => setH2(x.target.value)} disabled={!d} />
            </div>
          </div>
          <div className="civiq-field">
            <label htmlFor="dt-l" className="civiq-field-label">Lieu</label>
            <input id="dt-l" className="civiq-input" value={l} onChange={(x) => setL(x.target.value)} />
          </div>
        </>
      )}
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-wiz-inline">
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : null} Enregistrer
        </button>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, TrendingUp } from "lucide-react";
import { APERCU_PROMOTION, type Alerte } from "@/lib/projects/type-change";
import AlerteBlock from "./AlerteBlock";

// Deux boutons discrets en bas d'un suivi simple (brief §2.3, parcours C) :
//   • « Ajouter des devis » : fait apparaître le bloc Devis sans changer de type ;
//   • « Ce projet prend de l'ampleur » : promotion en investissement ou
//     événement, avec l'aperçu de ce qui sera ajouté.

interface Props {
  projectId: string;
  hasDevis: boolean;
}

type Cible = "investissement" | "evenementiel";

export default function SuiviActions({ projectId, hasDevis }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cible, setCible] = useState<Cible>("investissement");
  const [busy, setBusy] = useState(false);
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addDevis() {
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocs_supplementaires: ["devis"] }),
    });
    setBusy(false);
    if (res.ok) router.push(`/admin/projects/${projectId}?onglet=devis`);
    else setError("Le bloc devis n'a pas pu être ajouté.");
  }

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type_code: cible, ajouter_jalons: true, confirmer: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.alerte) { setAlerte(json.alerte); return; }
      if (!res.ok) throw new Error(json.error ?? "Le changement a échoué.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le changement a échoué.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pj-suivi-actions">
      <div className="pj-wiz-inline">
        {!hasDevis && (
          <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={addDevis} disabled={busy}>
            <FileText size={14} aria-hidden="true" /> Ajouter des devis
          </button>
        )}
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <TrendingUp size={14} aria-hidden="true" /> Ce projet prend de l&apos;ampleur
        </button>
      </div>

      {open && (
        <div className="civiq-card pj-promotion">
          <fieldset className="pj-wiz-fieldset">
            <legend className="civiq-field-label">Il devient…</legend>
            <label className="pj-wiz-check">
              <input type="radio" name="cible" checked={cible === "investissement"} onChange={() => setCible("investissement")} />
              un investissement (travaux, achat, aménagement)
            </label>
            <label className="pj-wiz-check">
              <input type="radio" name="cible" checked={cible === "evenementiel"} onChange={() => setCible("evenementiel")} />
              un événement (fête, cérémonie, inauguration)
            </label>
          </fieldset>
          <p className="pj-wiz-lead">Ce qui sera ajouté :</p>
          <ul className="pj-promotion-list">
            {APERCU_PROMOTION[cible].map((l) => <li key={l}>{l}</li>)}
          </ul>
          <p className="pj-wiz-note">Vos étapes, documents et contacts actuels sont conservés tels quels.</p>
          {alerte && <AlerteBlock alerte={alerte} role="alert" />}
          {error && <p className="pj-modal-error" role="alert">{error}</p>}
          <div className="pj-wiz-inline">
            <button type="button" className="civiq-btn civiq-btn-default civiq-btn-sm" onClick={promote} disabled={busy}>
              {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : null} Confirmer
            </button>
            <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { EXEMPLES_FINANCEURS_LOCAUX, type FinanceurLocal } from "@/lib/aides/financeurs-locaux";
import { ATTRIBUTION } from "@/lib/aides/aides";
import { TYPE_META } from "./TypeBadge";
import type { TypeProjetCode } from "@/lib/projects/types";

// Financeurs locaux (10 à 15 fiches) + état du cache Aides-territoires.

interface Props {
  initial: FinanceurLocal[];
  canEdit: boolean;
  sync: { finished_at: string | null; ok: boolean | null; nb_aides: number | null; erreur: string | null } | null;
  nbAides: number;
  codeInsee: string | null;
}

const TYPES: TypeProjetCode[] = ["investissement", "evenementiel", "suivi_simple"];
const dt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

export default function FinanceursLocauxManager({ initial, canEdit, sync, nbAides, codeInsee }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<FinanceurLocal[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [f, setF] = useState({ nom: "", periode_depot: "", lien: "", notes: "", types_projet: ["investissement"] as string[] });
  const [busy, setBusy] = useState(false);

  async function actualiser() {
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch("/api/aides/sync", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setSyncing(false);
    setSyncMsg(res.ok ? `${j.nb} aides mises à jour.` : j.erreur ?? j.error ?? "L'actualisation a échoué.");
    router.refresh();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/financeurs-locaux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "La fiche n'a pas été ajoutée."); return; }
    setRows((r) => [...r, j.financeur].sort((a, b) => a.nom.localeCompare(b.nom)));
    setF({ nom: "", periode_depot: "", lien: "", notes: "", types_projet: ["investissement"] });
  }

  async function remove(r: FinanceurLocal) {
    if (!window.confirm(`Retirer la fiche « ${r.nom} » ?`)) return;
    const res = await fetch(`/api/financeurs-locaux/${r.id}`, { method: "DELETE" });
    if (res.ok) setRows((l) => l.filter((x) => x.id !== r.id)); else setError("La fiche n'a pas été retirée.");
  }

  return (
    <div className="pj-params">
      <section className="civiq-card pj-params-card" aria-labelledby="at-titre">
        <h2 id="at-titre" className="pj-params-title">Aides publiques (Aides-territoires)</h2>
        <p className="pj-params-intro">
          GoCiviq récupère chaque semaine les aides ouvertes aux communes de votre territoire, et les propose sur les projets
          d&apos;investissement. Rien à saisir : il suffit que le code INSEE de la commune soit renseigné.
        </p>
        {!codeInsee ? (
          <p className="pj-alerte pj-alerte-information">Code INSEE non renseigné : ajoutez-le dans les paramètres de la commune.</p>
        ) : (
          <p className="pj-params-note">
            {nbAides} aide{nbAides > 1 ? "s" : ""} en mémoire.
            {sync?.finished_at ? ` Dernière actualisation : ${dt(sync.finished_at)}${sync.ok ? "" : " (échec — les données précédentes sont conservées)"}.` : " Pas encore d'actualisation."}
            {sync && !sync.ok && sync.erreur ? ` Détail : ${sync.erreur}` : ""}
          </p>
        )}
        {canEdit && codeInsee && (
          <div className="pj-wiz-inline">
            <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={actualiser} disabled={syncing}>
              {syncing ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />} Actualiser maintenant
            </button>
            {syncMsg && <p className="pj-params-status" role="status">{syncMsg}</p>}
          </div>
        )}
        <p className="pj-pistes-attribution">
          Données <a href={ATTRIBUTION.url} target="_blank" rel="noopener noreferrer">{ATTRIBUTION.source}</a> ({ATTRIBUTION.editeur}), {ATTRIBUTION.licence}.
        </p>
      </section>

      <section className="civiq-card pj-params-card" aria-labelledby="fl-titre">
        <h2 id="fl-titre" className="pj-params-title">Financeurs locaux</h2>
        <p className="pj-params-intro">
          Pour ce que la plateforme nationale couvre mal : 10 à 15 fiches suffisent. Par exemple : {EXEMPLES_FINANCEURS_LOCAUX.join(", ").toLowerCase()}.
        </p>
        {error && <p className="pj-modal-error" role="alert">{error}</p>}
        {rows.length === 0 ? (
          <p className="pj-section-empty">Aucune fiche pour l&apos;instant.</p>
        ) : (
          <ul className="pj-pp-list">
            {rows.map((r) => (
              <li key={r.id} className="pj-pp-item">
                <div>
                  <p className="pj-pp-nom">{r.nom}</p>
                  <p className="pj-pp-meta">
                    {r.types_projet.map((t) => TYPE_META[t as TypeProjetCode]?.label ?? t).join(", ")}
                    {r.periode_depot ? ` · dépôt : ${r.periode_depot}` : ""}
                    {r.lien ? <> · <a href={r.lien} target="_blank" rel="noopener noreferrer">lien</a></> : null}
                  </p>
                  {r.notes && <p className="pj-pp-meta">{r.notes}</p>}
                </div>
                {canEdit && (
                  <button type="button" className="civiq-icon-btn danger" onClick={() => remove(r)} aria-label={`Retirer la fiche ${r.nom}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form className="pj-pp-add" onSubmit={add} aria-labelledby="fl-add">
            <h3 id="fl-add" className="pj-etape-add-titre">Nouvelle fiche</h3>
            <div className="pj-params-grid">
              <div className="civiq-field">
                <label htmlFor="fl-nom" className="civiq-field-label">Financeur<span className="civiq-required" aria-hidden="true"> *</span></label>
                <input id="fl-nom" className="civiq-input" required list="fl-exemples" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
                <datalist id="fl-exemples">{EXEMPLES_FINANCEURS_LOCAUX.map((x) => <option key={x} value={x} />)}</datalist>
              </div>
              <div className="civiq-field">
                <label htmlFor="fl-periode" className="civiq-field-label">Période de dépôt habituelle</label>
                <input id="fl-periode" className="civiq-input" placeholder="Ex. avant fin mars" value={f.periode_depot} onChange={(e) => setF({ ...f, periode_depot: e.target.value })} />
              </div>
              <div className="civiq-field">
                <label htmlFor="fl-lien" className="civiq-field-label">Lien</label>
                <input id="fl-lien" className="civiq-input" type="url" placeholder="https://…" value={f.lien} onChange={(e) => setF({ ...f, lien: e.target.value })} />
              </div>
              <fieldset className="pj-wiz-fieldset">
                <legend className="civiq-field-label">Types de projet concernés</legend>
                {TYPES.map((t) => (
                  <label key={t} className="pj-wiz-check">
                    <input type="checkbox" checked={f.types_projet.includes(t)}
                      onChange={(e) => setF({ ...f, types_projet: e.target.checked ? [...f.types_projet, t] : f.types_projet.filter((x) => x !== t) })} />
                    {TYPE_META[t].label}
                  </label>
                ))}
              </fieldset>
              <div className="civiq-field pj-params-note-wide">
                <label htmlFor="fl-notes" className="civiq-field-label">Notes</label>
                <input id="fl-notes" className="civiq-input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="civiq-btn civiq-btn-default" disabled={busy}>
              {busy ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Ajouter la fiche
            </button>
          </form>
        ) : (
          <p className="pj-params-note">Seul un administrateur de la commune peut modifier ces fiches.</p>
        )}
      </section>
    </div>
  );
}

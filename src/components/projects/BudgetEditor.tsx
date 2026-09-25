"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  BUDGET_ETAT_META, totauxBudget, versHt, versTtc,
  type BudgetEtat, type LigneBudget,
} from "@/lib/projects/financement";
import { CATEGORIE_LABELS, CATEGORIES_DEPENSE, CATEGORIES_RECETTE } from "@/lib/projects/money-validation";
import { formatEuros } from "@/lib/projects/cost-calc";
import FieldHelp from "./FieldHelp";

// ═══════════════════════════════════════════════════════════════
// Budget d'un projet (brief §2.8 / parcours B).
//   investissement : dépenses en HT, 3 états prévu → engagé → payé ;
//   événement      : dépenses et recettes en TTC (fonctionnement),
//                    solde net affiché en permanence.
// Pas de plan de financement ni de FCTVA pour un événement.
// ═══════════════════════════════════════════════════════════════

export interface BudgetRow extends LigneBudget {
  id: string;
  categorie: string | null;
  libelle: string;
  chapitre_m57: string | null;
  operation: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  mode: "investissement" | "evenementiel";
  initial: BudgetRow[];
  canEdit: boolean;
}

const TVA_OPTIONS = [20, 10, 5.5, 0];

export default function BudgetEditor({ projectId, mode, initial, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<BudgetRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const base = mode === "investissement" ? "ht" : "ttc";
  const suffix = base === "ht" ? "HT" : "TTC";
  const totaux = totauxBudget(rows, base);

  async function patch(r: BudgetRow, fields: Partial<BudgetRow>) {
    const before = rows;
    setRows((l) => l.map((x) => (x.id === r.id ? { ...x, ...fields } : x)));
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/budget-lines/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setRows(before); setError(json.error ?? "La modification n'a pas été enregistrée."); return; }
    setRows((l) => l.map((x) => (x.id === r.id ? { ...x, ...json.budget_line } : x)));
    router.refresh();
  }

  async function remove(r: BudgetRow) {
    if (!window.confirm(`Retirer « ${r.libelle} » du budget ?`)) return;
    const before = rows;
    setRows((l) => l.filter((x) => x.id !== r.id));
    const res = await fetch(`/api/projects/${projectId}/budget-lines/${r.id}`, { method: "DELETE" });
    if (!res.ok) { setRows(before); setError("La ligne n'a pas été retirée."); } else router.refresh();
  }

  const section = (sens: "depense" | "recette") => {
    const list = rows.filter((r) => r.sens === sens);
    return (
      <div className="pj-budget-section">
        <h3 className="pj-budget-section-title">{sens === "depense" ? "Dépenses" : "Recettes"}</h3>
        {list.length === 0 ? (
          <p className="pj-section-empty">{sens === "depense" ? "Aucune dépense saisie." : "Aucune recette saisie."}</p>
        ) : (
          <ul className="pj-budget-list">
            {list.map((r) => {
              const prevu = r.montant_prevu === null ? null : Number(r.montant_prevu);
              const autre = prevu === null ? null : base === "ht" ? versTtc(prevu, r.base, Number(r.taux_tva)) : versHt(prevu, r.base, Number(r.taux_tva));
              return (
                <li key={r.id} className="pj-budget-item">
                  <div className="pj-budget-item-main">
                    <p className="pj-budget-libelle">{r.libelle}</p>
                    <p className="pj-budget-meta">
                      {r.categorie ? CATEGORIE_LABELS[r.categorie] ?? r.categorie : "Sans catégorie"}
                      {r.chapitre_m57 ? ` · chapitre ${r.chapitre_m57}` : ""}
                      {r.operation ? ` · opération ${r.operation}` : ""}
                    </p>
                  </div>
                  <div className="pj-budget-amounts">
                    <span className="pj-budget-amount">
                      {prevu === null ? "—" : formatEuros(prevu)} <small>{suffix} prévu</small>
                    </span>
                    {autre !== null && base === "ht" && <span className="pj-budget-sub">{formatEuros(autre)} TTC (TVA {r.taux_tva} %)</span>}
                    {r.etat !== "previsionnel" && r.montant_reel !== null && (
                      <span className="pj-budget-sub">{formatEuros(Number(r.montant_reel))} {suffix} {r.etat === "engage" ? "engagé" : "payé"}</span>
                    )}
                  </div>
                  {canEdit ? (
                    <div className="pj-budget-tools">
                      <label className="pj-sr-only" htmlFor={`etat-${r.id}`}>État de « {r.libelle} »</label>
                      <select id={`etat-${r.id}`} className="civiq-select pj-budget-etat" value={r.etat}
                        onChange={(e) => {
                          const etat = e.target.value as BudgetEtat;
                          // Engagé / payé : le montant prévu est repris, corrigeable juste à côté.
                          void patch(r, etat === "previsionnel" || r.montant_reel !== null ? { etat } : { etat, montant_reel: r.montant_prevu });
                        }}>
                        {(Object.keys(BUDGET_ETAT_META) as BudgetEtat[]).map((k) => <option key={k} value={k}>{BUDGET_ETAT_META[k].label}</option>)}
                      </select>
                      {r.etat !== "previsionnel" && (
                        <>
                          <label className="pj-sr-only" htmlFor={`reel-${r.id}`}>Montant {r.etat === "engage" ? "engagé" : "payé"} ({suffix})</label>
                          <input
                            id={`reel-${r.id}`}
                            key={`${r.id}-${r.montant_reel}`}
                            className="civiq-input pj-budget-reel"
                            inputMode="decimal"
                            defaultValue={r.montant_reel ?? ""}
                            placeholder={`Réel ${suffix}`}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== String(r.montant_reel ?? "")) void patch(r, { montant_reel: (v === "" ? null : v) as unknown as number });
                            }}
                          />
                        </>
                      )}
                      <button type="button" className="civiq-icon-btn danger" onClick={() => remove(r)} aria-label={`Retirer « ${r.libelle} »`}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <span className="pj-budget-etat-label">{BUDGET_ETAT_META[r.etat].label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && <AddLine projectId={projectId} sens={sens} base={base} onAdded={(r) => { setRows((l) => [...l, r]); router.refresh(); }} onError={setError} />}
      </div>
    );
  };

  return (
    <section className="pj-budget" aria-labelledby="budget-titre">
      <h2 id="budget-titre" className="pj-section-title">{mode === "evenementiel" ? "Budget de l'événement" : "Budget"}</h2>
      <p className="pj-wiz-note">
        {mode === "investissement"
          ? "Montants hors taxes (HT) : le montant des devis avant TVA. C'est lui qui sert aux règles des marchés publics et au calcul des subventions."
          : "Montants toutes taxes comprises (TTC), sur le budget de fonctionnement de la commune."}
      </p>
      <FieldHelp id="budget-etats">
        <p>
          <strong>Prévu</strong> : une estimation. <strong>Engagé</strong> : le devis est signé, la dépense est certaine, même si la facture
          n&apos;est pas encore payée. <strong>Payé</strong> : la facture est réglée. Ce qu&apos;il reste à dépenser se lit sur l&apos;engagé.
        </p>
      </FieldHelp>

      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      <dl className="pj-budget-totaux">
        <div><dt>Prévu</dt><dd>{formatEuros(totaux.prevu)} {suffix}</dd></div>
        <div><dt>Engagé</dt><dd>{formatEuros(totaux.engage)} {suffix}</dd></div>
        <div><dt>Payé</dt><dd>{formatEuros(totaux.mandate)} {suffix}</dd></div>
        {mode === "evenementiel" && (
          <div className={totaux.solde >= 0 ? "pj-solde-positif" : "pj-solde-negatif"}>
            <dt>Solde net</dt>
            <dd>{totaux.solde >= 0 ? "Excédent de " : "Déficit de "}{formatEuros(Math.abs(totaux.solde))}</dd>
          </div>
        )}
      </dl>

      {section("depense")}
      {mode === "evenementiel" && section("recette")}
    </section>
  );
}

function AddLine({ projectId, sens, base, onAdded, onError }: {
  projectId: string;
  sens: "depense" | "recette";
  base: "ht" | "ttc";
  onAdded: (r: BudgetRow) => void;
  onError: (e: string | null) => void;
}) {
  const [libelle, setLibelle] = useState("");
  const [categorie, setCategorie] = useState("");
  const [montant, setMontant] = useState("");
  const [tva, setTva] = useState(20);
  const [etat, setEtat] = useState<BudgetEtat>("previsionnel");
  const [chapitre, setChapitre] = useState("");
  const [busy, setBusy] = useState(false);
  const cats = sens === "depense" ? CATEGORIES_DEPENSE : CATEGORIES_RECETTE;
  const suffix = base === "ht" ? "HT" : "TTC";
  const id = `add-${sens}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    const body: Record<string, unknown> = {
      sens, libelle, categorie: categorie || null, taux_tva: tva, etat,
      ...(etat === "previsionnel" ? { montant_prevu: montant } : { montant_prevu: montant, montant_reel: montant }),
      chapitre_m57: chapitre || null,
    };
    const res = await fetch(`/api/projects/${projectId}/budget-lines`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !json.budget_line) { onError(json.error ?? "La ligne n'a pas été ajoutée."); return; }
    onAdded(json.budget_line as BudgetRow);
    setLibelle(""); setMontant(""); setCategorie(""); setChapitre(""); setEtat("previsionnel");
  }

  return (
    <form className="pj-budget-add" onSubmit={submit} aria-label={sens === "depense" ? "Ajouter une dépense" : "Ajouter une recette"}>
      <div className="pj-budget-add-row">
        <label className="pj-sr-only" htmlFor={`${id}-lib`}>Libellé</label>
        <input id={`${id}-lib`} className="civiq-input pj-budget-add-lib" required placeholder={sens === "depense" ? "Ex. Réfection de la toiture" : "Ex. Buvette"} value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        <label className="pj-sr-only" htmlFor={`${id}-cat`}>Catégorie</label>
        <select id={`${id}-cat`} className="civiq-select" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          <option value="">Catégorie…</option>
          {cats.map((c) => <option key={c} value={c}>{CATEGORIE_LABELS[c]}</option>)}
        </select>
        <label className="pj-sr-only" htmlFor={`${id}-m`}>Montant {suffix}</label>
        <input id={`${id}-m`} className="civiq-input pj-budget-add-m" required inputMode="decimal" placeholder={`Montant ${suffix}`} value={montant} onChange={(e) => setMontant(e.target.value)} />
        {base === "ht" && (
          <>
            <label className="pj-sr-only" htmlFor={`${id}-tva`}>Taux de TVA</label>
            <select id={`${id}-tva`} className="civiq-select" value={tva} onChange={(e) => setTva(Number(e.target.value))}>
              {TVA_OPTIONS.map((t) => <option key={t} value={t}>TVA {String(t).replace(".", ",")} %</option>)}
            </select>
          </>
        )}
        <label className="pj-sr-only" htmlFor={`${id}-etat`}>État</label>
        <select id={`${id}-etat`} className="civiq-select" value={etat} onChange={(e) => setEtat(e.target.value as BudgetEtat)}>
          {(Object.keys(BUDGET_ETAT_META) as BudgetEtat[]).map((k) => <option key={k} value={k}>{BUDGET_ETAT_META[k].label}</option>)}
        </select>
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} Ajouter
        </button>
      </div>
      {base === "ht" && sens === "depense" && (
        <details className="pj-budget-more">
          <summary>Imputation comptable (facultatif)</summary>
          <div className="civiq-field">
            <label htmlFor={`${id}-chap`} className="civiq-field-label">Chapitre / article (nomenclature M57)</label>
            <p id={`${id}-chap-hint`} className="civiq-field-hint">La ligne du budget communal où la dépense est inscrite. Votre secrétaire de mairie la connaît ; laissez vide sinon.</p>
            <input id={`${id}-chap`} className="civiq-input" value={chapitre} onChange={(e) => setChapitre(e.target.value)} aria-describedby={`${id}-chap-hint`} placeholder="Ex. 21 / 21318" />
          </div>
        </details>
      )}
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SUBVENTION_STATUTS, SUBVENTION_STATUT_META } from "@/lib/projects/money-validation";
import { subventionSansAr } from "@/lib/projects/financement";
import { formatEuros } from "@/lib/projects/cost-calc";
import AlerteBlock from "./AlerteBlock";
import FieldHelp from "./FieldHelp";

// ═══════════════════════════════════════════════════════════════
// Demandes de subvention d'un projet (onglet Financeurs).
// La date d'accusé de réception est centrale : sans elle, le démarrage
// des travaux est bloqué côté serveur (commencement d'exécution).
// Pas de montant estimé ni de taux « probable » : uniquement ce que la
// commune a demandé et ce que le financeur a notifié.
// ═══════════════════════════════════════════════════════════════

type Statut = (typeof SUBVENTION_STATUTS)[number];

export interface SubventionRow {
  id: string;
  financeur: string;
  dispositif: string | null;
  statut: Statut;
  assiette_ht: number | null;
  montant_demande: number | null;
  montant_obtenu: number | null;
  date_demande: string | null;
  date_ar: string | null;
  date_decision: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  initial: SubventionRow[];
  canEdit: boolean;
}

const dateFr = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }) : null);

export default function SubventionsEditor({ projectId, initial, canEdit }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<SubventionRow[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  async function patch(r: SubventionRow, fields: Partial<SubventionRow>) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/financings/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "La modification n'a pas été enregistrée."); return false; }
    setRows((l) => l.map((x) => (x.id === r.id ? json.financing : x)));
    router.refresh();
    return true;
  }
  async function remove(r: SubventionRow) {
    if (!window.confirm(`Retirer la demande « ${r.financeur} » ?`)) return;
    const res = await fetch(`/api/projects/${projectId}/financings/${r.id}`, { method: "DELETE" });
    if (res.ok) { setRows((l) => l.filter((x) => x.id !== r.id)); router.refresh(); } else setError("La demande n'a pas été retirée.");
  }

  const relances = rows.filter((r) => subventionSansAr(r, now));

  return (
    <section className="pj-subv" aria-labelledby="subv-titre">
      <h2 id="subv-titre" className="pj-section-title">Financeurs<span className="pj-section-count">{rows.length}</span></h2>

      {relances.length > 0 && (
        <AlerteBlock
          registre="recommande"
          alerte={{
            constat: `${relances.length === 1 ? "Une demande déposée attend" : `${relances.length} demandes déposées attendent`} un accusé de réception depuis plus de 3 semaines (${relances.map((r) => r.financeur).join(", ")}).`,
            consequence: "Tant que le financeur n'a pas accusé réception, les travaux ne peuvent pas démarrer sans risquer de perdre la subvention.",
            actions: ["Relancez le financeur par téléphone ou par mail, puis enregistrez la date de l'accusé de réception."],
          }}
        />
      )}

      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucune demande de subvention enregistrée.</p>
      ) : (
        <ul className="pj-pp-list">
          {rows.map((r) => {
            const meta = SUBVENTION_STATUT_META[r.statut];
            const open = openId === r.id;
            return (
              <li key={r.id} className="pj-subv-item">
                <div className="pj-pp-item">
                  <div>
                    <p className="pj-pp-nom">{r.financeur}{r.dispositif ? ` — ${r.dispositif}` : ""}</p>
                    <p className="pj-pp-meta">
                      <strong>{meta.label}</strong>
                      {r.montant_demande !== null && ` · demandé ${formatEuros(Number(r.montant_demande))}`}
                      {r.montant_obtenu !== null && ` · accordé ${formatEuros(Number(r.montant_obtenu))}`}
                    </p>
                    <p className="pj-pp-meta">
                      {r.date_demande ? `Déposé le ${dateFr(r.date_demande)}` : "Non déposé"}
                      {" · "}
                      {r.date_ar ? `accusé de réception le ${dateFr(r.date_ar)}` : <strong className="pj-subv-sans-ar">sans accusé de réception</strong>}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="pj-etape-tools">
                      <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={() => setOpenId(open ? null : r.id)} aria-expanded={open}>
                        Mettre à jour
                      </button>
                      <button type="button" className="civiq-icon-btn danger" onClick={() => remove(r)} aria-label={`Retirer la demande ${r.financeur}`}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
                {open && canEdit && (
                  <SubventionForm
                    initial={r}
                    submitLabel="Enregistrer"
                    onCancel={() => setOpenId(null)}
                    onSubmit={async (fields) => { if (await patch(r, fields)) setOpenId(null); }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <details className="pj-subv-add">
          <summary className="civiq-btn civiq-btn-outline civiq-btn-sm"><Plus size={14} aria-hidden="true" /> Ajouter une demande de subvention</summary>
          <SubventionForm
            submitLabel="Ajouter"
            onSubmit={async (fields) => {
              setError(null);
              const res = await fetch(`/api/projects/${projectId}/financings`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok || !json.financing) { setError(json.error ?? "La demande n'a pas été ajoutée."); return; }
              setRows((l) => [...l, json.financing]);
              router.refresh();
            }}
          />
        </details>
      )}
    </section>
  );
}

function SubventionForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: SubventionRow;
  submitLabel: string;
  onSubmit: (fields: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [f, setF] = useState({
    financeur: initial?.financeur ?? "",
    dispositif: initial?.dispositif ?? "",
    statut: (initial?.statut ?? "a_demander") as Statut,
    montant_demande: initial?.montant_demande?.toString() ?? "",
    montant_obtenu: initial?.montant_obtenu?.toString() ?? "",
    date_demande: initial?.date_demande ?? "",
    date_ar: initial?.date_ar ?? "",
    date_decision: initial?.date_decision ?? "",
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const idp = initial ? `sv-${initial.id}` : "sv-new";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Un accusé de réception saisi fait passer un dossier déposé « en cours d'étude ».
    const statut = f.date_ar && (f.statut === "a_demander" || f.statut === "demandee") ? "ar_recu" : f.statut;
    await onSubmit({
      ...f, statut,
      date_demande: f.date_demande || null, date_ar: f.date_ar || null, date_decision: f.date_decision || null,
    });
    setBusy(false);
  }

  return (
    <form className="pj-etape-details" onSubmit={submit}>
      <div className="pj-etape-details-grid">
        <div className="civiq-field">
          <label htmlFor={`${idp}-fin`} className="civiq-field-label">Financeur<span className="civiq-required" aria-hidden="true"> *</span></label>
          <input id={`${idp}-fin`} className="civiq-input" required value={f.financeur} onChange={(e) => set("financeur", e.target.value)} placeholder="Ex. État (préfecture), Département" />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${idp}-disp`} className="civiq-field-label">Dispositif</label>
          <input id={`${idp}-disp`} className="civiq-input" value={f.dispositif} onChange={(e) => set("dispositif", e.target.value)} placeholder="Ex. dotation d’équipement des territoires ruraux (DETR)" />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${idp}-st`} className="civiq-field-label">Où en est la demande ?</label>
          <select id={`${idp}-st`} className="civiq-select" value={f.statut} onChange={(e) => set("statut", e.target.value)} aria-describedby={`${idp}-st-hint`}>
            {SUBVENTION_STATUTS.map((s) => <option key={s} value={s}>{SUBVENTION_STATUT_META[s].label}</option>)}
          </select>
          <p id={`${idp}-st-hint`} className="civiq-field-hint">{SUBVENTION_STATUT_META[f.statut].aide}</p>
        </div>
        <div className="civiq-field">
          <label htmlFor={`${idp}-dem`} className="civiq-field-label">Montant demandé</label>
          <input id={`${idp}-dem`} className="civiq-input" inputMode="decimal" value={f.montant_demande} onChange={(e) => set("montant_demande", e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${idp}-dd`} className="civiq-field-label">Déposée le</label>
          <input id={`${idp}-dd`} type="date" className="civiq-input" value={f.date_demande} onChange={(e) => set("date_demande", e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${idp}-ar`} className="civiq-field-label">Accusé de réception de votre demande</label>
          <input id={`${idp}-ar`} type="date" className="civiq-input" value={f.date_ar} onChange={(e) => set("date_ar", e.target.value)} aria-describedby={`${idp}-ar-hint`} />
          <p id={`${idp}-ar-hint`} className="civiq-field-hint">
            Le courrier ou mail par lequel le financeur confirme avoir reçu votre dossier. Cette date est essentielle : sans elle, les travaux ne peuvent pas démarrer.
          </p>
        </div>
        {(f.statut === "accordee" || f.statut === "soldee" || f.statut === "refusee") && (
          <>
            <div className="civiq-field">
              <label htmlFor={`${idp}-dec`} className="civiq-field-label">Décision le</label>
              <input id={`${idp}-dec`} type="date" className="civiq-input" value={f.date_decision} onChange={(e) => set("date_decision", e.target.value)} />
            </div>
            {f.statut !== "refusee" && (
              <div className="civiq-field">
                <label htmlFor={`${idp}-obt`} className="civiq-field-label">Montant accordé</label>
                <input id={`${idp}-obt`} className="civiq-input" inputMode="decimal" value={f.montant_obtenu} onChange={(e) => set("montant_obtenu", e.target.value)} />
              </div>
            )}
          </>
        )}
        <div className="civiq-field pj-etape-details-wide">
          <label htmlFor={`${idp}-notes`} className="civiq-field-label">Commentaire</label>
          <input id={`${idp}-notes`} className="civiq-input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <FieldHelp id="subvention-montants">
        <p>Indiquez seulement ce que la commune a demandé et ce que le financeur a notifié par écrit : jamais un montant espéré.</p>
      </FieldHelp>
      <div className="pj-etape-details-actions">
        <span className="pj-spacer" />
        {onCancel && <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={onCancel}>Annuler</button>}
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : null} {submitLabel}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import type { Stakeholder } from "@/lib/projects/types";
import {
  evaluerAlertesMarches, fourchetteDeMontant, montantReferenceMarche, seuilsPourEncart,
  type CategorieAchat, type ParametresMarches, type Seuil,
} from "@/lib/projects/marches";
import { encartMarchesPublics } from "@/lib/projects/wizard";
import { formatEuros } from "@/lib/projects/cost-calc";
import AlerteBlock from "./AlerteBlock";
import FieldHelp from "./FieldHelp";
import LearnMore from "./LearnMore";

// ═══════════════════════════════════════════════════════════════
// Comparateur de devis (brief §2.7).
//   • Montant HT obligatoire et primaire ; TTC dérivé (calculé en base) ;
//   • un seul devis retenu par lot ;
//   • encart « Ce que la loi impose ici » et alertes calculés avec le seuil
//     en vigueur à la date de la consultation, recalculés à chaque saisie.
// ═══════════════════════════════════════════════════════════════

export interface DevisRow {
  id: string;
  prestataire: string;
  contact_id: string | null;
  objet: string | null;
  lot: string | null;
  montant_ht: number | null;
  taux_tva: number;
  montant_ttc: number | null;
  date_reception: string | null;
  validite: string | null;
  statut: "recu" | "en_attente" | "retenu" | "non_retenu";
  document_id: string | null;
  notes: string | null;
}

interface Props {
  projectId: string;
  initial: DevisRow[];
  documents: Array<{ id: string; nom: string; url: string }>;
  entreprises: Stakeholder[];
  canEdit: boolean;
  seuils: Seuil[];
  parametres: ParametresMarches;
  categorieAchat: CategorieAchat;
  dateConsultation: string | null;
  estimationHt: number | null;
}

const TVA = [20, 10, 5.5, 0];
const dateFr = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");

export default function DevisComparator({
  projectId, initial, documents, entreprises, canEdit, seuils, parametres,
  categorieAchat, dateConsultation, estimationHt,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<DevisRow[]>(initial);
  const [categorie, setCategorie] = useState<CategorieAchat>(categorieAchat);
  const [consultation, setConsultation] = useState(dateConsultation ?? "");
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState(documents);

  // Date de référence : consultation saisie, sinon premier devis reçu, sinon aujourd'hui.
  const dateRef = consultation
    || rows.map((r) => r.date_reception).filter((d): d is string => !!d).sort()[0]
    || new Date().toISOString().slice(0, 10);
  const ref = montantReferenceMarche(rows, estimationHt);
  const alertes = useMemo(
    () => evaluerAlertesMarches({ montantHt: ref.montant, categorie, dateConsultation: dateRef, nbDevis: rows.length, seuils, parametres }),
    [ref.montant, categorie, dateRef, rows.length, seuils, parametres],
  );
  const encart = encartMarchesPublics(fourchetteDeMontant(ref.montant), seuilsPourEncart(seuils, dateRef));
  const lots = [...new Set(rows.map((r) => r.lot ?? ""))];

  async function saveProject(fields: Record<string, unknown>) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    if (!res.ok) setError("La modification n'a pas été enregistrée.");
    else router.refresh();
  }

  async function patch(r: DevisRow, fields: Partial<DevisRow>) {
    const before = rows;
    setRows((l) => l.map((x) => {
      if (x.id === r.id) return { ...x, ...fields };
      // Retenir un devis écarte les autres retenus du même lot.
      if (fields.statut === "retenu" && x.statut === "retenu" && (x.lot ?? "") === (r.lot ?? "")) return { ...x, statut: "non_retenu" };
      return x;
    }));
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/quotes/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setRows(before); setError(json.error ?? "La modification n'a pas été enregistrée."); return; }
    setRows((l) => l.map((x) => (x.id === r.id ? json.quote : x)));
    router.refresh();
  }

  async function remove(r: DevisRow) {
    if (!window.confirm(`Retirer le devis de ${r.prestataire} ?`)) return;
    const before = rows;
    setRows((l) => l.filter((x) => x.id !== r.id));
    const res = await fetch(`/api/projects/${projectId}/quotes/${r.id}`, { method: "DELETE" });
    if (!res.ok) { setRows(before); setError("Le devis n'a pas été retiré."); } else router.refresh();
  }

  return (
    <section className="pj-devis" aria-labelledby="devis-titre">
      <h2 id="devis-titre" className="pj-section-title">Devis<span className="pj-section-count">{rows.length}</span></h2>

      {/* ─── Ce que la loi impose ici ─── */}
      {alertes.length > 0
        ? alertes.map((a) => (
            <AlerteBlock key={a.code} alerte={a.alerte} registre={a.registre}
              enSavoirPlus={a.enSavoirPlus.length ? a.enSavoirPlus.map((p) => <p key={p}>{p}</p>) : undefined} />
          ))
        : encart && (
            <section className={`pj-alerte pj-alerte-${encart.registre}`} aria-labelledby="encart-devis">
              <h3 id="encart-devis" className="pj-alerte-titre">{encart.titre}</h3>
              {encart.paragraphes.map((p) => <p key={p}>{p}</p>)}
              {encart.enSavoirPlus.length > 0 && <LearnMore>{encart.enSavoirPlus.map((p) => <p key={p}>{p}</p>)}</LearnMore>}
            </section>
          )}

      {/* ─── Consultation ─── */}
      <div className="pj-devis-consultation">
        <div className="civiq-field">
          <label htmlFor="devis-cat" className="civiq-field-label">Nature de l&apos;achat</label>
          <select id="devis-cat" className="civiq-select" value={categorie} disabled={!canEdit}
            onChange={(e) => { const v = e.target.value as CategorieAchat; setCategorie(v); void saveProject({ categorie_achat: v }); }}>
            <option value="travaux">Des travaux</option>
            <option value="fournitures_services">Des fournitures ou des services</option>
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="devis-date" className="civiq-field-label">Date de lancement de la consultation</label>
          <input id="devis-date" type="date" className="civiq-input" value={consultation} disabled={!canEdit}
            onChange={(e) => setConsultation(e.target.value)}
            onBlur={() => void saveProject({ date_consultation: consultation || null })} aria-describedby="devis-date-hint" />
          <p id="devis-date-hint" className="civiq-field-hint">
            Le jour où vous avez demandé les devis. Les règles appliquées sont celles en vigueur à cette date.
          </p>
        </div>
      </div>

      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucun devis enregistré.</p>
      ) : (
        lots.map((lot) => {
          const list = rows.filter((r) => (r.lot ?? "") === lot);
          const min = Math.min(...list.map((r) => Number(r.montant_ht ?? Infinity)));
          return (
            <div key={lot || "_"} className="pj-devis-lot">
              {lots.length > 1 && <h3 className="pj-budget-section-title">{lot ? `Lot : ${lot}` : "Sans lot"}</h3>}
              <div className="pj-table-wrap">
                <table className="pj-table pj-devis-table">
                  <caption className="pj-sr-only">Comparaison des devis{lot ? ` du lot ${lot}` : ""}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Entreprise</th>
                      <th scope="col">Objet</th>
                      <th scope="col">Montant HT</th>
                      <th scope="col">TVA</th>
                      <th scope="col">Montant TTC</th>
                      <th scope="col">Reçu le</th>
                      <th scope="col">Valable jusqu&apos;au</th>
                      <th scope="col">Retenu</th>
                      {canEdit && <th scope="col"><span className="pj-sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const doc = docs.find((d) => d.id === r.document_id);
                      return (
                        <tr key={r.id} className={r.statut === "retenu" ? "is-retenu" : undefined}>
                          <td data-label="Entreprise">
                            <strong>{r.prestataire}</strong>
                            {doc && <><br /><a href={doc.url} target="_blank" rel="noopener noreferrer"><Paperclip size={12} aria-hidden="true" /> {doc.nom}</a></>}
                            {r.notes && <><br /><span className="pj-table-sub">{r.notes}</span></>}
                          </td>
                          <td data-label="Objet">{r.objet ?? "—"}</td>
                          <td data-label="Montant HT" className="pj-table-strong">
                            {r.montant_ht === null ? "—" : formatEuros(Number(r.montant_ht))}
                            {list.length > 1 && Number(r.montant_ht) === min && <span className="pj-devis-moins-cher"> · le moins cher</span>}
                          </td>
                          <td data-label="TVA">{String(r.taux_tva).replace(".", ",")} %</td>
                          <td data-label="Montant TTC">{r.montant_ttc === null ? "—" : formatEuros(Number(r.montant_ttc))}</td>
                          <td data-label="Reçu le">{dateFr(r.date_reception)}</td>
                          <td data-label="Valable jusqu'au">{dateFr(r.validite)}</td>
                          <td data-label="Retenu">
                            {canEdit ? (
                              <label className="pj-wiz-check">
                                <input type="radio" name={`retenu-${lot || "_"}`} checked={r.statut === "retenu"}
                                  onChange={() => patch(r, { statut: "retenu" })} />
                                <span className="pj-sr-only">Retenir le devis de {r.prestataire}</span>
                                {r.statut === "retenu" && <span><CheckCircle2 size={14} aria-hidden="true" /> Retenu</span>}
                              </label>
                            ) : r.statut === "retenu" ? "Retenu" : "—"}
                          </td>
                          {canEdit && (
                            <td>
                              <button type="button" className="civiq-icon-btn danger" onClick={() => remove(r)} aria-label={`Retirer le devis de ${r.prestataire}`}>
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {canEdit && (
        <AddDevis projectId={projectId} entreprises={entreprises} lots={lots.filter(Boolean)}
          onAdded={(q, doc) => { setRows((l) => [...l, q]); if (doc) setDocs((d) => [...d, doc]); router.refresh(); }} onError={setError} />
      )}
    </section>
  );
}

function AddDevis({ projectId, entreprises, lots, onAdded, onError }: {
  projectId: string;
  entreprises: Stakeholder[];
  lots: string[];
  onAdded: (q: DevisRow, doc?: { id: string; nom: string; url: string }) => void;
  onError: (e: string | null) => void;
}) {
  const [f, setF] = useState({ prestataire: "", objet: "", lot: "", montant_ht: "", taux_tva: "20", date_reception: "", validite: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ttc = Number(f.montant_ht.replace(/\s/g, "").replace(",", ".")) * (1 + Number(f.taux_tva) / 100);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError(null);
    try {
      let doc: { id: string; nom: string; url: string } | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("nom", file.name);
        fd.append("type", "devis");
        const up = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
        const uj = await up.json().catch(() => ({}));
        if (!up.ok || !uj.document) throw new Error(uj.error ?? "Le fichier du devis n'a pas été ajouté.");
        doc = uj.document;
      }
      const contact = entreprises.find((c) => c.nom.toLowerCase() === f.prestataire.trim().toLowerCase());
      const res = await fetch(`/api/projects/${projectId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          lot: f.lot || null,
          taux_tva: Number(f.taux_tva),
          date_reception: f.date_reception || null,
          validite: f.validite || null,
          ...(contact ? { contact_id: contact.id } : {}),
          ...(doc ? { document_id: doc.id } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.quote) throw new Error(json.error ?? "Le devis n'a pas été ajouté.");
      onAdded(json.quote, doc);
      setF({ prestataire: "", objet: "", lot: f.lot, montant_ht: "", taux_tva: f.taux_tva, date_reception: "", validite: "", notes: "" });
      setFile(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Le devis n'a pas été ajouté.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pj-pp-add" onSubmit={submit} aria-labelledby="add-devis-titre">
      <h3 id="add-devis-titre" className="pj-etape-add-titre">Ajouter un devis</h3>
      <div className="pj-params-grid">
        <div className="civiq-field">
          <label htmlFor="dv-ent" className="civiq-field-label">Entreprise<span className="civiq-required" aria-hidden="true"> *</span></label>
          <input id="dv-ent" className="civiq-input" list="dv-ent-list" required value={f.prestataire} onChange={(e) => set("prestataire", e.target.value)} />
          <datalist id="dv-ent-list">{entreprises.map((c) => <option key={c.id} value={c.nom} />)}</datalist>
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-objet" className="civiq-field-label">Objet</label>
          <input id="dv-objet" className="civiq-input" value={f.objet} onChange={(e) => set("objet", e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-ht" className="civiq-field-label">Montant hors taxes (HT)<span className="civiq-required" aria-hidden="true"> *</span></label>
          <input id="dv-ht" className="civiq-input" inputMode="decimal" required value={f.montant_ht} onChange={(e) => set("montant_ht", e.target.value)} aria-describedby="dv-ht-hint" />
          <p id="dv-ht-hint" className="civiq-field-hint">
            {Number.isFinite(ttc) && ttc > 0 ? `Soit ${formatEuros(Math.round(ttc * 100) / 100)} TTC.` : "Le montant avant TVA, tel qu'il figure sur le devis."}
          </p>
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-tva" className="civiq-field-label">Taux de TVA</label>
          <select id="dv-tva" className="civiq-select" value={f.taux_tva} onChange={(e) => set("taux_tva", e.target.value)}>
            {TVA.map((t) => <option key={t} value={t}>{String(t).replace(".", ",")} %</option>)}
          </select>
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-recu" className="civiq-field-label">Reçu le</label>
          <input id="dv-recu" type="date" className="civiq-input" value={f.date_reception} onChange={(e) => set("date_reception", e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-valid" className="civiq-field-label">Valable jusqu&apos;au</label>
          <input id="dv-valid" type="date" className="civiq-input" value={f.validite} onChange={(e) => set("validite", e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-lot" className="civiq-field-label">Lot (facultatif)</label>
          <input id="dv-lot" className="civiq-input" list="dv-lot-list" value={f.lot} onChange={(e) => set("lot", e.target.value)} placeholder="Ex. Charpente" />
          <datalist id="dv-lot-list">{lots.map((l) => <option key={l} value={l} />)}</datalist>
        </div>
        <div className="civiq-field">
          <label htmlFor="dv-file" className="civiq-field-label">Fichier du devis (facultatif)</label>
          <input id="dv-file" type="file" className="civiq-input" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="civiq-field pj-params-note-wide">
          <label htmlFor="dv-notes" className="civiq-field-label">Commentaire</label>
          <input id="dv-notes" className="civiq-input" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      <FieldHelp id="devis-lot">
        <p>Un lot regroupe les devis d&apos;une même partie des travaux (ex. charpente, électricité). Vous retenez un devis par lot.</p>
      </FieldHelp>
      <button type="submit" className="civiq-btn civiq-btn-default" disabled={busy}>
        {busy ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Ajouter le devis
      </button>
    </form>
  );
}

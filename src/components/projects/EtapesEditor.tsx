"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Circle, CircleDot, Flag, Loader2,
  MessageSquare, Paperclip, Plus, Trash2, UserRound, X,
} from "lucide-react";
import type { EtapeStatut, Milestone, ProjectDocument, Stakeholder } from "@/lib/projects/types";
import {
  ETAPE_STATUTS, ETAPE_STATUT_META, formatEtapeDate, isEnRetard, nextStatut,
  sortEtapes, sortRetroplanning, statutOf,
} from "@/lib/projects/etapes";
import FieldHelp from "./FieldHelp";

// ═══════════════════════════════════════════════════════════════
// Étapes d'un projet (brief §2.4) — commun aux trois types.
//   • ajout sur une seule ligne : statut, libellé, date ;
//   • pièce jointe, partie prenante, commentaire : icônes facultatives ;
//   • statut = couleur + icône + libellé ; retard signalé en texte ;
//   • mode « rétroplanning » (événement) : retards en tête, puis par date.
// Mises à jour optimistes, annulées si le serveur refuse.
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  initial: Milestone[];
  documents: ProjectDocument[];
  contactsByEtape: Record<string, Stakeholder[]>;
  directory: Stakeholder[];
  canEdit: boolean;
  mode?: "etapes" | "retroplanning";
}

const STATUT_ICONS = { Circle, CircleDot, CheckCircle2 };

function toInputDate(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "";
}
function toInputTime(iso: string | null | undefined) {
  if (!iso || iso.includes("T00:00:00")) return "";
  return iso.slice(11, 16);
}
function fromInputs(date: string, time: string): string | null {
  if (!date) return null;
  return `${date}T${time || "00:00"}:00.000Z`;
}

export function StatutBadge({ statut }: { statut: EtapeStatut }) {
  const meta = ETAPE_STATUT_META[statut];
  const Icon = STATUT_ICONS[meta.icon];
  return (
    <span className="pj-etape-statut" style={{ background: meta.bg }}>
      <Icon size={13} aria-hidden="true" /> {meta.label}
    </span>
  );
}

export default function EtapesEditor({
  projectId, initial, documents, contactsByEtape, directory, canEdit, mode = "etapes",
}: Props) {
  const router = useRouter();
  const [etapes, setEtapes] = useState<Milestone[]>(initial);
  const [docs, setDocs] = useState<ProjectDocument[]>(documents);
  const [contacts, setContacts] = useState<Record<string, Stakeholder[]>>(contactsByEtape);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulaire d'ajout (une ligne)
  const [libelle, setLibelle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [statut, setStatut] = useState<EtapeStatut>("a_faire");
  const [jalon, setJalon] = useState(false);
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const now = useMemo(() => new Date(), []);
  const list = mode === "retroplanning" ? sortRetroplanning(etapes, now) : sortEtapes(etapes);
  const lateCount = etapes.filter((e) => isEnRetard(e, now)).length;

  async function patch(id: string, fields: Record<string, unknown>, optimistic: Partial<Milestone>) {
    const before = etapes;
    setEtapes((l) => l.map((e) => (e.id === id ? { ...e, ...optimistic } : e)));
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "La modification n'a pas été enregistrée.");
      if (json.milestone) setEtapes((l) => l.map((e) => (e.id === id ? json.milestone : e)));
      router.refresh();
    } catch (e) {
      setEtapes(before);
      setError(e instanceof Error ? e.message : "La modification n'a pas été enregistrée.");
    }
  }

  async function add(ev: FormEvent) {
    ev.preventDefault();
    if (!libelle.trim()) { addInputRef.current?.focus(); return; }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libelle, statut, date_previsionnelle: fromInputs(date, time), est_un_jalon: jalon }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.milestone) throw new Error(json.error ?? "L'étape n'a pas été ajoutée.");
      setEtapes((l) => [...l, json.milestone]);
      setLibelle(""); setDate(""); setTime(""); setStatut("a_faire"); setJalon(false);
      addInputRef.current?.focus();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'étape n'a pas été ajoutée.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(e: Milestone) {
    if (!window.confirm(`Retirer l'étape « ${e.libelle} » ? Elle reste conservée dans l'historique du projet.`)) return;
    const before = etapes;
    setEtapes((l) => l.filter((x) => x.id !== e.id));
    const res = await fetch(`/api/projects/${projectId}/milestones/${e.id}`, { method: "DELETE" });
    if (!res.ok) { setEtapes(before); setError("L'étape n'a pas été retirée."); }
    else router.refresh();
  }

  async function move(e: Milestone, dir: -1 | 1) {
    const sorted = sortEtapes(etapes);
    const i = sorted.findIndex((x) => x.id === e.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i];
    const b = sorted[j];
    const oa = a.ordre ?? (i + 1) * 10;
    const ob = b.ordre ?? (j + 1) * 10;
    const newA = oa === ob ? ob + dir : ob;
    await patch(a.id, { ordre: newA }, { ordre: newA });
    await patch(b.id, { ordre: oa }, { ordre: oa });
  }

  async function attach(e: Milestone, file: File, noteInterne: boolean) {
    setBusy(e.id);
    setError(null);
    try {
      let upload: File = file;
      if (file.type.startsWith("image/")) {
        const blob = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2400, useWebWorker: true });
        upload = new File([blob], file.name, { type: blob.type });
      }
      if (upload.size > 20 * 1024 * 1024) throw new Error("Fichier trop volumineux (20 Mo au maximum).");
      const fd = new FormData();
      fd.append("file", upload);
      fd.append("nom", file.name);
      fd.append("type", "autre");
      fd.append("milestone_id", e.id);
      fd.append("note_interne", String(noteInterne));
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.document) throw new Error(json.error ?? "Le fichier n'a pas été ajouté.");
      setDocs((d) => [json.document, ...d]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Le fichier n'a pas été ajouté.");
    } finally {
      setBusy(null);
    }
  }

  async function linkContact(e: Milestone, contactId: string) {
    const c = directory.find((x) => x.id === contactId);
    if (!c) return;
    setContacts((m) => ({ ...m, [e.id]: [...(m[e.id] ?? []), c] }));
    const res = await fetch(`/api/projects/${projectId}/milestones/${e.id}/contacts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_id: contactId }),
    });
    if (!res.ok) {
      setContacts((m) => ({ ...m, [e.id]: (m[e.id] ?? []).filter((x) => x.id !== contactId) }));
      setError("La partie prenante n'a pas été ajoutée.");
    }
  }
  async function unlinkContact(e: Milestone, contactId: string) {
    const before = contacts;
    setContacts((m) => ({ ...m, [e.id]: (m[e.id] ?? []).filter((x) => x.id !== contactId) }));
    const res = await fetch(`/api/projects/${projectId}/milestones/${e.id}/contacts?contact_id=${encodeURIComponent(contactId)}`, { method: "DELETE" });
    if (!res.ok) { setContacts(before); setError("La partie prenante n'a pas été retirée."); }
  }

  return (
    <section className="pj-etapes" aria-labelledby="etapes-titre">
      <div className="pj-etapes-head">
        <h2 id="etapes-titre" className="pj-section-title">
          {mode === "retroplanning" ? "Rétroplanning" : "Étapes"}
          <span className="pj-section-count">{etapes.length}</span>
        </h2>
        {lateCount > 0 && (
          <p className="pj-etapes-late-summary">
            <AlertTriangle size={14} aria-hidden="true" /> {lateCount} étape{lateCount > 1 ? "s" : ""} en retard
          </p>
        )}
      </div>

      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      {list.length === 0 ? (
        <p className="pj-section-empty">
          Aucune étape pour l&apos;instant. Ajoutez la première ci-dessous : une réunion, un devis demandé, une date clé…
        </p>
      ) : (
        <ol className="pj-etapes-list">
          {list.map((e) => {
            const s = statutOf(e);
            const late = isEnRetard(e, now);
            const open = openId === e.id;
            const eDocs = docs.filter((d) => d.milestone_id === e.id);
            const eContacts = contacts[e.id] ?? [];
            const sortedIdx = sortEtapes(etapes).findIndex((x) => x.id === e.id);
            return (
              <li key={e.id} className={`pj-etape${late ? " is-late" : ""}${s === "termine" ? " is-done" : ""}`}>
                <div className="pj-etape-row">
                  {canEdit ? (
                    <button
                      type="button"
                      className="pj-etape-statut-btn"
                      onClick={() => patch(e.id, { statut: nextStatut(s) }, { statut: nextStatut(s), fait: nextStatut(s) === "termine" })}
                      aria-label={`Statut : ${ETAPE_STATUT_META[s].label}. Passer à « ${ETAPE_STATUT_META[nextStatut(s)].label} »`}
                    >
                      <StatutBadge statut={s} />
                    </button>
                  ) : (
                    <StatutBadge statut={s} />
                  )}
                  <div className="pj-etape-main">
                    <p className="pj-etape-libelle">{e.libelle}</p>
                    <p className="pj-etape-meta">
                      {e.est_un_jalon !== false && (
                        <span className="pj-etape-jalon"><Flag size={12} aria-hidden="true" /> Étape clé</span>
                      )}
                      {formatEtapeDate(e.date_previsionnelle) ?? "Sans date"}
                      {s === "termine" && e.date_reelle && <> · fait le {formatEtapeDate(e.date_reelle)}</>}
                      {late && (
                        <span className="pj-etape-late"><AlertTriangle size={12} aria-hidden="true" /> En retard</span>
                      )}
                    </p>
                    {(eDocs.length > 0 || eContacts.length > 0 || e.commentaire) && (
                      <ul className="pj-etape-extras">
                        {eDocs.map((d) => (
                          <li key={d.id}>
                            <Paperclip size={12} aria-hidden="true" />{" "}
                            <a href={d.url} target="_blank" rel="noopener noreferrer">{d.nom}</a>
                            {d.note_interne && <span className="pj-etape-interne">note interne</span>}
                          </li>
                        ))}
                        {eContacts.map((c) => (
                          <li key={c.id}>
                            <UserRound size={12} aria-hidden="true" /> {c.nom}
                            {c.organisation ? ` (${c.organisation})` : ""}
                            {c.email ? <> · <a href={`mailto:${c.email}`}>{c.email}</a></> : null}
                            {c.telephone ? ` · ${c.telephone}` : ""}
                          </li>
                        ))}
                        {e.commentaire && (
                          <li>
                            <MessageSquare size={12} aria-hidden="true" /> « {e.commentaire} »
                            {e.commentaire_note_interne && <span className="pj-etape-interne">note interne</span>}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  {canEdit && (
                    <div className="pj-etape-tools">
                      <button type="button" className="civiq-icon-btn" onClick={() => setOpenId(open ? null : e.id)}
                        aria-expanded={open} aria-controls={`etape-${e.id}`}
                        aria-label={`Détails de l'étape « ${e.libelle} » : dates, pièce jointe, partie prenante, commentaire`}>
                        {busy === e.id ? <Loader2 size={15} className="civiq-spin" aria-hidden="true" /> : <MessageSquare size={15} aria-hidden="true" />}
                      </button>
                      {mode === "etapes" && (
                        <>
                          <button type="button" className="civiq-icon-btn" onClick={() => move(e, -1)} disabled={sortedIdx === 0}
                            aria-label={`Monter « ${e.libelle} »`}><ArrowUp size={15} aria-hidden="true" /></button>
                          <button type="button" className="civiq-icon-btn" onClick={() => move(e, 1)} disabled={sortedIdx === etapes.length - 1}
                            aria-label={`Descendre « ${e.libelle} »`}><ArrowDown size={15} aria-hidden="true" /></button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {open && canEdit && (
                  <EtapeDetails
                    id={`etape-${e.id}`}
                    etape={e}
                    contacts={eContacts}
                    directory={directory}
                    onSave={(fields, optimistic) => patch(e.id, fields, optimistic)}
                    onAttach={(f, interne) => attach(e, f, interne)}
                    onLink={(cid) => linkContact(e, cid)}
                    onUnlink={(cid) => unlinkContact(e, cid)}
                    onRemove={() => remove(e)}
                    onClose={() => setOpenId(null)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && (
        <form className="pj-etape-add" onSubmit={add} id="ajouter-etape" aria-labelledby="etape-add-titre">
          <h3 id="etape-add-titre" className="pj-etape-add-titre">Ajouter une étape</h3>
          <div className="pj-etape-add-row">
            <label className="pj-sr-only" htmlFor="etape-statut">Statut</label>
            <select id="etape-statut" className="civiq-select pj-etape-add-statut" value={statut} onChange={(e) => setStatut(e.target.value as EtapeStatut)}>
              {ETAPE_STATUTS.map((s) => <option key={s} value={s}>{ETAPE_STATUT_META[s].label}</option>)}
            </select>
            <label className="pj-sr-only" htmlFor="etape-libelle">Libellé de l&apos;étape</label>
            <input id="etape-libelle" ref={addInputRef} className="civiq-input pj-etape-add-libelle" value={libelle}
              onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Réunion de lancement des travaux" maxLength={300} />
            <label className="pj-sr-only" htmlFor="etape-date">Date prévue</label>
            <input id="etape-date" type="date" className="civiq-input pj-etape-add-date" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="pj-sr-only" htmlFor="etape-heure">Heure (facultative)</label>
            <input id="etape-heure" type="time" className="civiq-input pj-etape-add-time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date} />
            <button type="submit" className="civiq-btn civiq-btn-default" disabled={adding}>
              {adding ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />} Ajouter
            </button>
          </div>
          <label className="pj-wiz-check pj-etape-add-jalon">
            <input type="checkbox" checked={jalon} onChange={(e) => setJalon(e.target.checked)} />
            C&apos;est une étape clé (jalon)
          </label>
          <FieldHelp id="etape-jalon">
            <p>
              Seules les étapes clés comptent dans l&apos;avancement du projet. Une simple réunion n&apos;en est pas une ;
              la signature d&apos;un devis ou la réception des travaux, si.
            </p>
          </FieldHelp>
        </form>
      )}

      {canEdit && (
        <a href="#ajouter-etape" className="pj-fab" onClick={() => setTimeout(() => addInputRef.current?.focus(), 0)}>
          <Plus size={22} aria-hidden="true" /><span className="pj-sr-only">Ajouter une étape</span>
        </a>
      )}
    </section>
  );
}

// ─── Panneau de détail d'une étape ───
function EtapeDetails({
  id, etape, contacts, directory, onSave, onAttach, onLink, onUnlink, onRemove, onClose,
}: {
  id: string;
  etape: Milestone;
  contacts: Stakeholder[];
  directory: Stakeholder[];
  onSave: (fields: Record<string, unknown>, optimistic: Partial<Milestone>) => void;
  onAttach: (f: File, interne: boolean) => void;
  onLink: (contactId: string) => void;
  onUnlink: (contactId: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [libelle, setLibelle] = useState(etape.libelle);
  const [dPrev, setDPrev] = useState(toInputDate(etape.date_previsionnelle));
  const [tPrev, setTPrev] = useState(toInputTime(etape.date_previsionnelle));
  const [dReel, setDReel] = useState(toInputDate(etape.date_reelle));
  const [jalon, setJalon] = useState(etape.est_un_jalon !== false);
  const [reporting, setReporting] = useState(etape.remonter_au_reporting !== false);
  const [commentaire, setCommentaire] = useState(etape.commentaire ?? "");
  const [interne, setInterne] = useState(!!etape.commentaire_note_interne);
  const [fileInterne, setFileInterne] = useState(false);
  const [categorie, setCategorie] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const available = directory
    .filter((c) => !contacts.some((x) => x.id === c.id))
    .filter((c) => !categorie || c.type === categorie);

  function save(ev: FormEvent) {
    ev.preventDefault();
    const fields = {
      libelle,
      date_previsionnelle: fromInputs(dPrev, tPrev),
      date_reelle: dReel ? `${dReel}T00:00:00.000Z` : null,
      est_un_jalon: jalon,
      remonter_au_reporting: reporting,
      commentaire,
      commentaire_note_interne: interne,
    };
    onSave(fields, { ...fields, commentaire: commentaire.trim() || null });
    onClose();
  }

  return (
    <form id={id} className="pj-etape-details" onSubmit={save}>
      <div className="pj-etape-details-grid">
        <div className="civiq-field pj-etape-details-wide">
          <label htmlFor={`${id}-lib`} className="civiq-field-label">Libellé</label>
          <input id={`${id}-lib`} className="civiq-input" value={libelle} onChange={(e) => setLibelle(e.target.value)} required maxLength={300} />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${id}-dp`} className="civiq-field-label">Date prévue</label>
          <input id={`${id}-dp`} type="date" className="civiq-input" value={dPrev} onChange={(e) => setDPrev(e.target.value)} />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${id}-tp`} className="civiq-field-label">Heure (facultative)</label>
          <input id={`${id}-tp`} type="time" className="civiq-input" value={tPrev} onChange={(e) => setTPrev(e.target.value)} disabled={!dPrev} />
        </div>
        <div className="civiq-field">
          <label htmlFor={`${id}-dr`} className="civiq-field-label">Date réelle</label>
          <p id={`${id}-dr-hint`} className="civiq-field-hint">Le jour où c&apos;est effectivement fait.</p>
          <input id={`${id}-dr`} type="date" className="civiq-input" value={dReel} onChange={(e) => setDReel(e.target.value)} aria-describedby={`${id}-dr-hint`} />
        </div>
      </div>

      <div className="pj-etape-details-checks">
        <label className="pj-wiz-check"><input type="checkbox" checked={jalon} onChange={(e) => setJalon(e.target.checked)} /> Étape clé (compte dans l&apos;avancement)</label>
        <label className="pj-wiz-check"><input type="checkbox" checked={reporting} onChange={(e) => setReporting(e.target.checked)} /> Afficher dans le compte rendu d&apos;avancement (reporting)</label>
      </div>

      <div className="civiq-field">
        <label htmlFor={`${id}-com`} className="civiq-field-label">Commentaire</label>
        <textarea id={`${id}-com`} className="civiq-textarea" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        <label className="pj-wiz-check">
          <input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} /> Note interne
        </label>
        <FieldHelp id="note-interne">
          <p>
            Une note interne n&apos;apparaît pas dans la version communicable de la fiche projet, celle que la commune
            transmet quand un citoyen ou un conseiller municipal demande les documents.
          </p>
        </FieldHelp>
      </div>

      <fieldset className="pj-wiz-fieldset">
        <legend className="civiq-field-label">Pièce jointe</legend>
        <input ref={fileRef} type="file" className="pj-sr-only" id={`${id}-file`}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f, fileInterne); e.target.value = ""; }} />
        <div className="pj-wiz-inline">
          <label htmlFor={`${id}-file`} className="civiq-btn civiq-btn-outline civiq-btn-sm">
            <Paperclip size={14} aria-hidden="true" /> Joindre un fichier
          </label>
          <label className="pj-wiz-check"><input type="checkbox" checked={fileInterne} onChange={(e) => setFileInterne(e.target.checked)} /> Note interne</label>
        </div>
        <p className="civiq-field-hint">PDF, image, Word ou Excel — 20 Mo au maximum. Les photos sont allégées automatiquement.</p>
      </fieldset>

      <fieldset className="pj-wiz-fieldset">
        <legend className="civiq-field-label">Parties prenantes</legend>
        {contacts.length > 0 && (
          <ul className="pj-etape-chips">
            {contacts.map((c) => (
              <li key={c.id} className="pj-etape-chip">
                {c.nom}
                <button type="button" onClick={() => onUnlink(c.id)} aria-label={`Retirer ${c.nom}`}><X size={12} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="pj-wiz-inline">
          <label className="pj-sr-only" htmlFor={`${id}-cat`}>Filtrer par catégorie</label>
          <select id={`${id}-cat`} className="civiq-select" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            <option value="">Toutes catégories</option>
            <option value="interne">Interne</option>
            <option value="institutionnelle">Institutionnelle</option>
            <option value="financeur">Financeur</option>
            <option value="technique">Technique</option>
            <option value="citoyenne">Citoyenne</option>
          </select>
          <label className="pj-sr-only" htmlFor={`${id}-ct`}>Ajouter une partie prenante</label>
          <select id={`${id}-ct`} className="civiq-select" value="" onChange={(e) => e.target.value && onLink(e.target.value)}>
            <option value="">Ajouter depuis l&apos;annuaire…</option>
            {available.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.organisation ? ` (${c.organisation})` : ""}</option>)}
          </select>
        </div>
      </fieldset>

      <div className="pj-etape-details-actions">
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm pj-danger-text" onClick={onRemove}>
          <Trash2 size={14} aria-hidden="true" /> Retirer l&apos;étape
        </button>
        <span className="pj-spacer" />
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={onClose}>Annuler</button>
        <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm">Enregistrer</button>
      </div>
    </form>
  );
}

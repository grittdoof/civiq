"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, X, Loader2, Upload, Trash2, Check, ExternalLink,
} from "lucide-react";
import {
  QUOTE_STATUT_LABELS,
  type ProjectPhase,
  type ProjectQuote,
  type QuoteStatut,
} from "@/lib/projects/types";
import { formatEuros } from "@/lib/projects/cost-calc";

// ═══════════════════════════════════════════════════════════════
// QuotesComparator — tableau comparatif des devis d'un projet.
//
//   • Colonnes : prestataire | objet | HT | TTC | délai | statut | PJ | ×
//   • Ajout via formulaire inline + upload PJ (via /api/projects/:id/documents)
//   • Statut éditable inline (menu déroulant)
//   • Suppression avec confirmation implicite
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  phase: ProjectPhase;
  canEdit: boolean;
}

const STATUT_ORDER: QuoteStatut[] = ["recu", "en_attente", "retenu", "non_retenu"];

export default function QuotesComparator({ projectId, phase, canEdit }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [quotes, setQuotes] = useState<ProjectQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/quotes`);
      if (r.ok) {
        const d = (await r.json()) as { quotes: ProjectQuote[] };
        setQuotes(d.quotes.filter((q) => q.phase === phase));
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatut(qid: string, statut: QuoteStatut) {
    setQuotes((qs) => qs.map((q) => (q.id === qid ? { ...q, statut } : q)));
    await fetch(`/api/projects/${projectId}/quotes/${qid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    startTransition(() => router.refresh());
  }

  async function remove(qid: string) {
    if (!confirm("Supprimer ce devis ?")) return;
    await fetch(`/api/projects/${projectId}/quotes/${qid}`, { method: "DELETE" });
    setQuotes((qs) => qs.filter((q) => q.id !== qid));
    startTransition(() => router.refresh());
  }

  const retenuId = quotes.find((q) => q.statut === "retenu")?.id ?? null;

  return (
    <section className="pj-quotes-comparator">
      <header className="pj-quotes-head">
        <h3 className="pj-quotes-title">
          <FileText size={16} /> Comparateur de devis
        </h3>
        <p className="pj-quotes-sub">
          Comparez les devis reçus pour cette phase. Un seul peut être marqué
          « retenu » — les autres passent automatiquement en « non retenu ».
        </p>
      </header>

      {loading ? (
        <p className="pj-quotes-loading"><Loader2 size={14} className="spin" /> Chargement…</p>
      ) : quotes.length === 0 ? (
        <p className="pj-quotes-empty">Aucun devis pour l&apos;instant.</p>
      ) : (
        <div className="pj-quotes-table-wrap">
          <table className="pj-quotes-table">
            <thead>
              <tr>
                <th>Prestataire</th>
                <th>Objet</th>
                <th className="pj-quotes-num">HT</th>
                <th className="pj-quotes-num">TTC</th>
                <th className="pj-quotes-num">Délai</th>
                <th>Statut</th>
                <th>PJ</th>
                {canEdit && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const isRetenu = q.id === retenuId;
                return (
                  <tr key={q.id} className={isRetenu ? "is-retenu" : ""}>
                    <td>
                      {isRetenu && <Check size={12} className="pj-quotes-check" />}
                      <strong>{q.prestataire}</strong>
                    </td>
                    <td>{q.objet ?? <span className="pj-list-muted">—</span>}</td>
                    <td className="pj-quotes-num">
                      {q.montant_ht !== null ? formatEuros(q.montant_ht) : "—"}
                    </td>
                    <td className="pj-quotes-num">
                      {q.montant_ttc !== null ? formatEuros(q.montant_ttc) : "—"}
                    </td>
                    <td className="pj-quotes-num">
                      {q.delai_jours !== null ? `${q.delai_jours} j` : "—"}
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          className={`pj-quotes-statut is-${q.statut}`}
                          value={q.statut}
                          onChange={(e) => updateStatut(q.id, e.target.value as QuoteStatut)}
                        >
                          {STATUT_ORDER.map((s) => (
                            <option key={s} value={s}>{QUOTE_STATUT_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`pj-quotes-statut-badge is-${q.statut}`}>
                          {QUOTE_STATUT_LABELS[q.statut]}
                        </span>
                      )}
                    </td>
                    <td>
                      {q.document_id ? (
                        <QuoteDocLink documentId={q.document_id} />
                      ) : (
                        <span className="pj-list-muted">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="pj-quotes-del"
                          onClick={() => remove(q.id)}
                          aria-label="Supprimer le devis"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && !addOpen && (
        <button
          type="button"
          className="pj-quotes-add-btn"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={14} /> Ajouter un devis
        </button>
      )}
      {canEdit && addOpen && (
        <QuoteForm
          projectId={projectId}
          phase={phase}
          onDone={() => {
            setAddOpen(false);
            load();
            startTransition(() => router.refresh());
          }}
          onCancel={() => setAddOpen(false)}
        />
      )}
    </section>
  );
}

// ─── Formulaire d'ajout (avec upload PJ) ───
function QuoteForm({
  projectId,
  phase,
  onDone,
  onCancel,
}: {
  projectId: string;
  phase: ProjectPhase;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [prestataire, setPrestataire] = useState("");
  const [objet, setObjet] = useState("");
  const [ht, setHt] = useState("");
  const [ttc, setTtc] = useState("");
  const [delai, setDelai] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prestataire.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      // 1. Upload du PDF (si fourni) → project_documents
      let documentId: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("nom", `Devis ${prestataire.trim()}`);
        fd.append("type", "devis");
        const upl = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: fd,
        });
        if (!upl.ok) {
          const j = (await upl.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Erreur upload PJ");
        }
        const uplData = (await upl.json()) as { document?: { id: string } };
        documentId = uplData.document?.id ?? null;
      }

      // 2. Création du devis
      const r = await fetch(`/api/projects/${projectId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          prestataire: prestataire.trim(),
          objet: objet.trim() || null,
          montant_ht: ht ? Number(ht) : null,
          montant_ttc: ttc ? Number(ttc) : null,
          delai_jours: delai ? Number(delai) : null,
          statut: "recu",
          document_id: documentId,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Erreur");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setSaving(false);
    }
  }

  return (
    <form className="pj-free-form" onSubmit={submit}>
      <div className="pj-free-form-head">
        <FileText size={14} />
        <strong>Nouveau devis</strong>
        <button type="button" className="pj-free-form-close" onClick={onCancel} aria-label="Annuler">
          <X size={14} />
        </button>
      </div>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="q-prest">Prestataire</label>
          <input
            id="q-prest"
            type="text"
            className="civiq-input"
            value={prestataire}
            onChange={(e) => setPrestataire(e.target.value)}
            placeholder="SARL Dupont Travaux"
            autoFocus
            required
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="q-objet">Objet</label>
          <input
            id="q-objet"
            type="text"
            className="civiq-input"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder="Fourniture et pose"
          />
        </div>
      </div>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="q-ht">Montant HT (€)</label>
          <input
            id="q-ht"
            type="number"
            step="0.01"
            className="civiq-input"
            value={ht}
            onChange={(e) => setHt(e.target.value)}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="q-ttc">Montant TTC (€)</label>
          <input
            id="q-ttc"
            type="number"
            step="0.01"
            className="civiq-input"
            value={ttc}
            onChange={(e) => setTtc(e.target.value)}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="q-delai">Délai (jours)</label>
          <input
            id="q-delai"
            type="number"
            className="civiq-input"
            value={delai}
            onChange={(e) => setDelai(e.target.value)}
          />
        </div>
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="q-pj">Devis PDF (optionnel)</label>
        <input
          id="q-pj"
          type="file"
          accept="application/pdf,image/*"
          className="civiq-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && <p className="pj-free-form-error">{error}</p>}
      <div className="pj-free-form-actions">
        <button
          type="button"
          className="civiq-btn civiq-btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="civiq-btn"
          disabled={saving || !prestataire.trim()}
        >
          {saving ? (
            <><Loader2 size={13} className="spin" /> {file ? <><Upload size={13} /> Upload…</> : "Enregistrement…"}</>
          ) : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

// ─── Résolution de l'URL signée d'un document ───
function QuoteDocLink({ documentId }: { documentId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ok = true;
    (async () => {
      // Documents endpoint retourne toutes les docs du projet — pas efficace
      // mais on n'a pas d'endpoint /documents/:did dédié. Cache implicite navigateur.
      const path = window.location.pathname;
      const match = path.match(/\/admin\/projects\/([^/]+)/);
      if (!match) return;
      const r = await fetch(`/api/projects/${match[1]}/documents`);
      if (!r.ok || !ok) return;
      const d = (await r.json()) as { documents: Array<{ id: string; url: string }> };
      const doc = d.documents.find((x) => x.id === documentId);
      if (ok) setUrl(doc?.url ?? null);
    })();
    return () => { ok = false; };
  }, [documentId]);

  if (!url) return <span className="pj-list-muted">…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="pj-quotes-doc-link">
      <ExternalLink size={12} /> Voir
    </a>
  );
}

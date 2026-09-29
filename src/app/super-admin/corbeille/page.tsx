"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, RotateCcw, Trash2 } from "lucide-react";
import "../../admin/projects/projects.css";

// ═══════════════════════════════════════════════════════════════
// /super-admin/corbeille — projets supprimés par les communes.
// 30 jours pour restaurer ; suppression définitive possible à tout
// moment (sauvegarde JSON + pièces jointes archivées d'abord), et
// automatique au-delà de 30 jours.
// ═══════════════════════════════════════════════════════════════

interface Ligne {
  id: string;
  titre: string;
  type_code: string | null;
  confidentiel: boolean;
  commune: string;
  supprime_le: string;
  supprime_par: string;
  motif: string | null;
  jours_restants: number;
}

const TYPE: Record<string, string> = { investissement: "Investissement", evenementiel: "Événement", suivi_simple: "Suivi simple" };
const dt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function CorbeillePage() {
  const [rows, setRows] = useState<Ligne[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/super-admin/corbeille");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Chargement impossible."); return; }
    setRows(j.projets);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function action(r: Ligne, kind: "restaurer" | "purger") {
    const question = kind === "restaurer"
      ? `Restaurer « ${r.titre} » ? Il réapparaîtra aussitôt pour la commune ${r.commune}.`
      : `Supprimer définitivement « ${r.titre} » (${r.commune}) ?\n\nUne sauvegarde JSON et les pièces jointes sont d'abord archivées, puis toutes les données du projet sont effacées. Cette action ne peut pas être annulée dans GoCiviq.`;
    if (!window.confirm(question)) return;
    setBusy(r.id + kind);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/super-admin/corbeille/${r.id}`, { method: kind === "restaurer" ? "POST" : "DELETE" });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? "L'opération a échoué."); return; }
    setMessage(kind === "restaurer" ? `« ${r.titre} » est restauré.` : `« ${r.titre} » est supprimé définitivement. Sauvegarde : ${j.sauvegarde}.`);
    await load();
  }

  return (
    <main className="rgpd-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>Corbeille des projets</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>
            Projets supprimés par les communes. Restauration possible pendant 30 jours ; au-delà, suppression définitive
            automatique, après sauvegarde.
          </p>
        </div>
      </header>

      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      {message && <p className="pj-params-status" role="status">{message}</p>}

      <section className="civiq-card" style={{ padding: 20 }}>
        {!rows ? (
          !error && <p className="pj-params-note"><Loader2 size={14} className="civiq-spin" aria-hidden="true" /> Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="pj-section-empty">La corbeille est vide.</p>
        ) : (
          <div className="pj-table-wrap">
            <table className="pj-table">
              <caption className="pj-sr-only">Projets à la corbeille</caption>
              <thead>
                <tr>
                  <th scope="col">Projet</th>
                  <th scope="col">Commune</th>
                  <th scope="col">Supprimé</th>
                  <th scope="col">Suppression définitive</th>
                  <th scope="col"><span className="pj-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.titre}</strong>
                      <div className="pj-table-sub">
                        {TYPE[r.type_code ?? "suivi_simple"]}{r.confidentiel ? " · confidentiel" : ""}{r.motif ? ` · « ${r.motif} »` : ""}
                      </div>
                    </td>
                    <td>{r.commune}</td>
                    <td className="pj-table-sub">le {dt(r.supprime_le)}<br />par {r.supprime_par}</td>
                    <td>
                      {r.jours_restants === 0
                        ? <span className="civiq-badge civiq-badge-error">Cette nuit</span>
                        : <span className={`civiq-badge ${r.jours_restants <= 7 ? "civiq-badge-warning" : "civiq-badge-muted"}`}>Dans {r.jours_restants} jour{r.jours_restants > 1 ? "s" : ""}</span>}
                    </td>
                    <td>
                      <div className="pj-agenda-row">
                        <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" disabled={!!busy} onClick={() => action(r, "restaurer")}>
                          {busy === r.id + "restaurer" ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <RotateCcw size={14} aria-hidden="true" />} Restaurer
                        </button>
                        <a className="civiq-btn civiq-btn-ghost civiq-btn-sm" href={`/api/super-admin/corbeille/${r.id}/sauvegarde`}>
                          <Download size={14} aria-hidden="true" /> Sauvegarde JSON
                        </a>
                        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm pj-agenda-danger" disabled={!!busy} onClick={() => action(r, "purger")}>
                          {busy === r.id + "purger" ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} Supprimer définitivement
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="pj-params-note">
        Chaque suppression écrit une sauvegarde JSON (toutes les lignes du projet : étapes, budget, devis, subventions,
        documents, délibérations…) dans l&apos;espace de stockage privé « project-archives », avec une copie des pièces jointes
        et de la photo. Les tickets et décisions de séance liés sont conservés, sans lien vers le projet.
      </p>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Archive, ArchiveRestore, Trash2, Settings2 } from "lucide-react";

interface CommuneRow {
  id: string; name: string; slug: string; code_postal: string | null;
  user_count: number; survey_count: number; response_count: number; module_count: number;
  created_at: string;
  archived_at: string | null;
}

export default function SuperAdminCommunes() {
  const [communes, setCommunes] = useState<CommuneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    fetch("/api/super-admin/communes")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCommunes(d))
      .finally(() => setLoading(false));
  }

  async function toggleArchive(c: CommuneRow) {
    const action = c.archived_at ? "unarchive" : "archive";
    const verb = c.archived_at ? "désarchiver" : "archiver";
    if (!confirm(`Voulez-vous ${verb} la commune « ${c.name} » ?`)) return;

    const res = await fetch(`/api/super-admin/communes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Erreur" }));
      alert(body.error);
      return;
    }
    load();
  }

  async function hardDelete(c: CommuneRow) {
    const ok = confirm(
      `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
      `Vous êtes sur le point de supprimer « ${c.name} » avec :\n` +
      `  • ${c.user_count} utilisateur(s) (leur commune sera mise à null)\n` +
      `  • ${c.survey_count} sondage(s)\n` +
      `  • ${c.response_count} réponse(s)\n` +
      `  • ${c.module_count} module(s) activé(s)\n\n` +
      `Cette action est irréversible. Continuer ?`
    );
    if (!ok) return;
    const confirm2 = prompt(`Pour confirmer, tapez le slug de la commune : ${c.slug}`);
    if (confirm2 !== c.slug) {
      alert("Slug incorrect, suppression annulée.");
      return;
    }

    const res = await fetch(`/api/super-admin/communes/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Erreur" }));
      alert(body.error);
      return;
    }
    setCommunes((prev) => prev.filter((x) => x.id !== c.id));
  }

  const filtered = communes
    .filter((c) => (showArchived ? c.archived_at : !c.archived_at))
    .filter((c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.slug.toLowerCase().includes(q.toLowerCase()) ||
      (c.code_postal ?? "").includes(q)
    );

  const activeCount = communes.filter((c) => !c.archived_at).length;
  const archivedCount = communes.filter((c) => c.archived_at).length;

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <h1 className="civiq-h1">Communes</h1>
        <p className="civiq-muted">
          {activeCount} active{activeCount > 1 ? "s" : ""}
          {archivedCount > 0 && ` · ${archivedCount} archivée${archivedCount > 1 ? "s" : ""}`}
        </p>
      </header>

      <div className="sa-toolbar">
        <div className="sa-search">
          <Search size={16} className="sa-search-icon" />
          <input
            type="search"
            placeholder="Rechercher une commune…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="civiq-input"
          />
        </div>
        <div className="sa-tabs">
          <button type="button" onClick={() => setShowArchived(false)} className={!showArchived ? "active" : ""}>
            Actives ({activeCount})
          </button>
          <button type="button" onClick={() => setShowArchived(true)} className={showArchived ? "active" : ""}>
            Archivées ({archivedCount})
          </button>
        </div>
      </div>

      <div className="civiq-card" style={{ overflow: "hidden" }}>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Commune</th>
              <th>Code postal</th>
              <th>Membres</th>
              <th>Sondages</th>
              <th>Réponses</th>
              <th>Modules</th>
              <th>Créée</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="sa-cell-empty">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="sa-cell-empty">Aucune commune.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className={c.archived_at ? "row-archived" : ""}>
                  <td>
                    <div className="sa-commune-cell">
                      <div className="sa-commune-mini">{c.name.charAt(0)}</div>
                      <div>
                        <strong>{c.name}</strong>
                        <span className="civiq-muted" style={{ fontSize: 12, fontFamily: "monospace" }}>/{c.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>{c.code_postal || "—"}</td>
                  <td><b>{c.user_count}</b></td>
                  <td><b>{c.survey_count}</b></td>
                  <td><b>{c.response_count}</b></td>
                  <td><span className="civiq-badge civiq-badge-info">{c.module_count}</span></td>
                  <td>{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="sa-row-actions">
                      <Link
                        href={`/super-admin/communes/${c.id}`}
                        className="sa-icon-btn"
                        title="Gérer modules & utilisateurs"
                      >
                        <Settings2 size={16} />
                      </Link>
                      <button
                        type="button"
                        className="sa-icon-btn"
                        title={c.archived_at ? "Désarchiver" : "Archiver"}
                        onClick={() => toggleArchive(c)}
                      >
                        {c.archived_at ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                      <button
                        type="button"
                        className="sa-icon-btn danger"
                        title="Supprimer définitivement"
                        onClick={() => hardDelete(c)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 40px 32px 60px; }
        .sa-page-header { margin-bottom: 24px; }
        .sa-page-header p { margin-top: 6px; }

        .sa-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .sa-search { position: relative; max-width: 360px; flex: 1; min-width: 240px; }
        .sa-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--civiq-text-soft); pointer-events: none; }
        .sa-search .civiq-input { padding-left: 40px; width: 100%; }

        .sa-tabs {
          display: flex;
          background: var(--civiq-surface-2);
          border-radius: 10px;
          padding: 3px;
          border: 1px solid var(--civiq-border);
        }
        .sa-tabs button {
          padding: 7px 14px;
          border: none;
          background: none;
          color: var(--civiq-text-soft);
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border-radius: 7px;
          transition: 0.15s;
        }
        .sa-tabs button.active { background: #fff; color: var(--civiq-text); box-shadow: var(--civiq-shadow-xs); }

        .sa-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sa-table th { text-align: left; padding: 14px 16px; background: var(--civiq-surface-2); color: var(--civiq-text-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--civiq-border); }
        .sa-table td { padding: 14px 16px; border-bottom: 1px solid var(--civiq-border); }
        .sa-table tr:last-child td { border-bottom: none; }
        .sa-table tr:hover { background: var(--civiq-surface-2); }
        .sa-table tr.row-archived { opacity: 0.55; }
        .sa-table b { font-weight: 700; }
        .sa-cell-empty { text-align: center; color: var(--civiq-text-soft); padding: 40px !important; }

        .sa-commune-cell { display: flex; align-items: center; gap: 12px; }
        .sa-commune-mini {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ff5a5f, #c93a3f);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
        }
        .sa-commune-cell strong { display: block; color: var(--civiq-text); }

        .sa-row-actions { display: inline-flex; gap: 6px; }
        .sa-icon-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid var(--civiq-border);
          background: #fff;
          color: var(--civiq-text-soft);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: 0.15s;
        }
        .sa-icon-btn:hover { border-color: var(--civiq-text); color: var(--civiq-text); }
        .sa-icon-btn.danger:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
      `}</style>
    </div>
  );
}

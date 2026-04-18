"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface CommuneRow {
  id: string; name: string; slug: string; code_postal: string | null;
  user_count: number; survey_count: number; response_count: number; module_count: number;
  created_at: string;
}

export default function SuperAdminCommunes() {
  const [communes, setCommunes] = useState<CommuneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/super-admin/communes")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCommunes(d))
      .finally(() => setLoading(false));
  }, []);

  const filtered = communes.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.slug.toLowerCase().includes(q.toLowerCase()) ||
      (c.code_postal ?? "").includes(q)
  );

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <h1 className="civiq-h1">Communes</h1>
        <p className="civiq-muted">{communes.length} commune{communes.length > 1 ? "s" : ""} sur la plateforme.</p>
      </header>

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="sa-cell-empty">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="sa-cell-empty">Aucune commune.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
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
                  <td>
                    <span className="civiq-badge civiq-badge-info">{c.module_count}</span>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
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

        .sa-search {
          position: relative;
          margin-bottom: 20px;
          max-width: 360px;
        }
        .sa-search-icon {
          position: absolute;
          left: 14px; top: 50%;
          transform: translateY(-50%);
          color: var(--civiq-text-soft);
          pointer-events: none;
        }
        .sa-search .civiq-input { padding-left: 40px; }

        .sa-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .sa-table th {
          text-align: left;
          padding: 14px 16px;
          background: var(--civiq-surface-2);
          color: var(--civiq-text-soft);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--civiq-border);
        }
        .sa-table td {
          padding: 16px;
          border-bottom: 1px solid var(--civiq-border);
        }
        .sa-table tr:last-child td { border-bottom: none; }
        .sa-table tr:hover { background: var(--civiq-surface-2); }
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
      `}</style>
    </div>
  );
}

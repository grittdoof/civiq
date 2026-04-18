"use client";

import { useState, useEffect } from "react";
import { Search, Shield } from "lucide-react";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  commune_id: string | null;
  communes: { name: string; slug: string } | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLES = [
  { value: "super_admin", label: "Super Admin", color: "civiq-badge-error" },
  { value: "admin", label: "Admin", color: "civiq-badge-info" },
  { value: "editor", label: "Éditeur", color: "civiq-badge-success" },
  { value: "viewer", label: "Lecteur", color: "civiq-badge" },
];

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    fetch("/api/super-admin/users")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d))
      .finally(() => setLoading(false));
  }

  async function changeRole(userId: string, role: string) {
    await fetch("/api/super-admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });
    load();
  }

  const filtered = users.filter(
    (u) =>
      (u.email || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.communes?.name || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <h1 className="civiq-h1">Utilisateurs</h1>
        <p className="civiq-muted">{users.length} compte{users.length > 1 ? "s" : ""} sur la plateforme.</p>
      </header>

      <div className="sa-search">
        <Search size={16} className="sa-search-icon" />
        <input type="search" placeholder="Rechercher (email, nom, commune)…" value={q} onChange={(e) => setQ(e.target.value)} className="civiq-input" />
      </div>

      <div className="civiq-card" style={{ overflow: "hidden" }}>
        <table className="sa-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Commune</th>
              <th>Rôle</th>
              <th>Inscrit</th>
              <th>Dernière connexion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="sa-cell-empty">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="sa-cell-empty">Aucun utilisateur.</td></tr>
            ) : (
              filtered.map((u) => {
                const role = ROLES.find((r) => r.value === u.role) || ROLES[3];
                const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="sa-user-cell">
                        <div className="sa-user-avatar">
                          {u.role === "super_admin" ? <Shield size={16} /> : initial}
                        </div>
                        <div>
                          <strong>{u.full_name || "(Sans nom)"}</strong>
                          <span className="civiq-muted">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.communes ? (
                        <div>
                          <strong>{u.communes.name}</strong>
                          <div className="civiq-muted" style={{ fontSize: 12, fontFamily: "monospace" }}>/{u.communes.slug}</div>
                        </div>
                      ) : (
                        <span className="civiq-muted">—</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className={`civiq-badge ${role.color}`}
                        style={{ border: "none", padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="civiq-muted">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="civiq-muted">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 40px 32px 60px; }
        .sa-page-header { margin-bottom: 24px; }
        .sa-page-header p { margin-top: 6px; }
        .sa-search { position: relative; margin-bottom: 20px; max-width: 420px; }
        .sa-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--civiq-text-soft); pointer-events: none; }
        .sa-search .civiq-input { padding-left: 40px; }
        .sa-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sa-table th { text-align: left; padding: 14px 16px; background: var(--civiq-surface-2); color: var(--civiq-text-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--civiq-border); }
        .sa-table td { padding: 16px; border-bottom: 1px solid var(--civiq-border); }
        .sa-table tr:last-child td { border-bottom: none; }
        .sa-table tr:hover { background: var(--civiq-surface-2); }
        .sa-cell-empty { text-align: center; color: var(--civiq-text-soft); padding: 40px !important; }
        .sa-user-cell { display: flex; align-items: center; gap: 12px; }
        .sa-user-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--civiq-text); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        .sa-user-cell strong { display: block; color: var(--civiq-text); }
        .sa-user-cell .civiq-muted { font-size: 12px; }
      `}</style>
    </div>
  );
}

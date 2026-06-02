"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Shield, ShieldCheck, Edit3, Eye, Download, Trash2, PencilLine, X, Save, History,
} from "lucide-react";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  job_title: string | null;
  commune_id: string | null;
  communes: { name: string; slug: string } | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface CommuneOption { id: string; name: string; }

// ─── Rôles ───
const ROLES: Array<{ value: string; label: string; color: string }> = [
  { value: "super_admin", label: "Super Administrateur", color: "civiq-badge-error" },
  { value: "admin", label: "Administrateur", color: "civiq-badge-info" },
  { value: "editor", label: "Éditeur", color: "civiq-badge-success" },
  { value: "viewer", label: "Administré", color: "civiq-badge" },
];

// ─── Fonctions (job titles) ───
const JOB_TITLES: Array<{ value: string; label: string; group: string }> = [
  { value: "maire", label: "Maire", group: "Élus" },
  { value: "adjoint", label: "Adjoint au maire", group: "Élus" },
  { value: "conseiller", label: "Conseiller municipal", group: "Élus" },
  { value: "dgs", label: "Directeur Général des Services", group: "Services" },
  { value: "secretaire", label: "Secrétaire de mairie", group: "Services" },
  { value: "agent", label: "Agent territorial", group: "Services" },
  { value: "citoyen", label: "Administré", group: "Citoyens" },
  { value: "autre", label: "Autre", group: "Autres" },
];

const JOB_LABEL: Record<string, string> = Object.fromEntries(JOB_TITLES.map((j) => [j.value, j.label]));
const JOB_GROUP_ORDER = ["Élus", "Services", "Citoyens", "Autres", "Non renseigné"];

function getGroup(u: UserRow): string {
  if (!u.job_title) return "Non renseigné";
  const jt = JOB_TITLES.find((j) => j.value === u.job_title);
  return jt?.group ?? "Non renseigné";
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);

  useEffect(() => {
    load();
    fetch("/api/super-admin/communes")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCommunes(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
  }, []);

  function load() {
    setLoading(true);
    fetch("/api/super-admin/users")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setUsers(d))
      .finally(() => setLoading(false));
  }

  async function handleDelete(u: UserRow) {
    const name = u.full_name || u.email || "cet utilisateur";
    if (!confirm(`Supprimer définitivement « ${name} » ?\n\nSon compte et son profil seront supprimés.`)) return;

    const res = await fetch(`/api/super-admin/users?user_id=${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Erreur" }));
      alert(body.error);
      return;
    }
    setUsers((prev) => prev.filter((x) => x.id !== u.id));
  }

  const filtered = users.filter(
    (u) =>
      (u.email || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.full_name || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.communes?.name || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.job_title && JOB_LABEL[u.job_title]?.toLowerCase().includes(q.toLowerCase()))
  );

  // Grouper par catégorie de fonction
  const groups: Record<string, UserRow[]> = {};
  filtered.forEach((u) => {
    const g = getGroup(u);
    if (!groups[g]) groups[g] = [];
    groups[g].push(u);
  });

  const sortedGroups = JOB_GROUP_ORDER.filter((g) => groups[g]?.length);

  return (
    <div className="sa-page">
      <header className="sa-page-header">
        <div>
          <h1 className="civiq-h1">Utilisateurs</h1>
          <p className="civiq-muted">
            {users.length} compte{users.length > 1 ? "s" : ""} · groupés par fonction
          </p>
        </div>
        <a
          href="/api/super-admin/users/export"
          className="civiq-btn civiq-btn-dark civiq-btn-sm"
          download
        >
          <Download size={15} /> Exporter (CSV / Excel)
        </a>
      </header>

      <div className="sa-search">
        <Search size={16} className="sa-search-icon" />
        <input
          type="search"
          placeholder="Rechercher (email, nom, commune, fonction)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="civiq-input"
        />
      </div>

      {loading ? (
        <div className="sa-empty">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="sa-empty">Aucun utilisateur.</div>
      ) : (
        sortedGroups.map((g) => (
          <section key={g} className="user-group">
            <div className="group-head">
              <h2>{g}</h2>
              <span className="civiq-muted">
                {groups[g].length} membre{groups[g].length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="civiq-card" style={{ overflow: "hidden", marginBottom: 24 }}>
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Fonction</th>
                    <th>Commune</th>
                    <th>Rôle</th>
                    <th>Dernière connexion</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups[g].map((u) => {
                    const role = ROLES.find((r) => r.value === u.role) || ROLES[3];
                    const initial = (u.full_name || u.email || "?").charAt(0).toUpperCase();
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="sa-user-cell">
                            <div className="sa-user-avatar">
                              {u.role === "super_admin" ? <ShieldCheck size={16} /> : initial}
                            </div>
                            <div>
                              <strong>{u.full_name || "(Sans nom)"}</strong>
                              <span className="civiq-muted">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.job_title ? (
                            <span className="civiq-badge">{JOB_LABEL[u.job_title]}</span>
                          ) : (
                            <span className="civiq-muted">—</span>
                          )}
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
                          <span className={`civiq-badge ${role.color}`}>
                            {u.role === "super_admin" ? <ShieldCheck size={12} /> :
                             u.role === "admin" ? <Shield size={12} /> :
                             u.role === "editor" ? <Edit3 size={12} /> : <Eye size={12} />}
                            {role.label}
                          </span>
                        </td>
                        <td className="civiq-muted">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="sa-row-actions">
                            <Link
                              href={`/super-admin/users/${u.id}/historique`}
                              className="sa-icon-btn"
                              title="Historique des actions"
                            >
                              <History size={16} />
                            </Link>
                            <button
                              type="button"
                              className="sa-icon-btn"
                              title="Modifier"
                              onClick={() => setEditing(u)}
                            >
                              <PencilLine size={16} />
                            </button>
                            <button
                              type="button"
                              className="sa-icon-btn danger"
                              title="Supprimer"
                              onClick={() => handleDelete(u)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {/* Modal d'édition */}
      {editing && (
        <EditUserModal
          user={editing}
          communes={communes}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <style>{`
        .sa-page { max-width: 1200px; margin: 0 auto; padding: 40px 32px 60px; }
        .sa-page-header {
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
        }
        .sa-page-header p { margin-top: 6px; }

        .sa-search { position: relative; margin-bottom: 24px; max-width: 480px; }
        .sa-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--civiq-text-soft); pointer-events: none; }
        .sa-search .civiq-input { padding-left: 40px; }

        .user-group { }
        .group-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .group-head h2 {
          font-size: 16px;
          font-weight: 700;
          color: var(--civiq-text);
          font-family: 'Playfair Display', serif;
        }

        .sa-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sa-table th { text-align: left; padding: 12px 16px; background: var(--civiq-surface-2); color: var(--civiq-text-soft); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--civiq-border); }
        .sa-table td { padding: 14px 16px; border-bottom: 1px solid var(--civiq-border); }
        .sa-table tr:last-child td { border-bottom: none; }
        .sa-table tr:hover { background: var(--civiq-surface-2); }

        .sa-user-cell { display: flex; align-items: center; gap: 12px; }
        .sa-user-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: var(--civiq-text);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 600;
        }
        .sa-user-cell strong { display: block; color: var(--civiq-text); }
        .sa-user-cell .civiq-muted { font-size: 12px; }

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

        .sa-empty {
          background: #fff;
          border: 1px dashed var(--civiq-border-strong);
          border-radius: var(--civiq-radius);
          padding: 48px;
          text-align: center;
          color: var(--civiq-text-soft);
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal d'édition d'un utilisateur
// ─────────────────────────────────────────────────────────────
function EditUserModal({
  user, communes, onClose, onSaved,
}: {
  user: UserRow;
  communes: CommuneOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name || "");
  const [role, setRole] = useState(user.role);
  const [jobTitle, setJobTitle] = useState(user.job_title || "");
  const [communeId, setCommuneId] = useState(user.commune_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/super-admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        full_name: fullName.trim() || null,
        role,
        job_title: jobTitle || null,
        commune_id: communeId || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Erreur" }));
      setError(body.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Modifier l'utilisateur</h2>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="civiq-field-label">Email (non modifiable)</label>
            <input type="email" value={user.email ?? ""} disabled className="civiq-input" />
          </div>

          <div className="field">
            <label className="civiq-field-label">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="civiq-input"
              placeholder="Prénom Nom"
            />
          </div>

          <div className="row">
            <div className="field">
              <label className="civiq-field-label">Rôle (niveau d'accès)</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="civiq-input">
                <option value="super_admin">Super Administrateur</option>
                <option value="admin">Administrateur</option>
                <option value="editor">Éditeur</option>
                <option value="viewer">Administré</option>
              </select>
            </div>

            <div className="field">
              <label className="civiq-field-label">Fonction</label>
              <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="civiq-input">
                <option value="">— Non renseigné —</option>
                <optgroup label="Élus">
                  <option value="maire">Maire</option>
                  <option value="adjoint">Adjoint au maire</option>
                  <option value="conseiller">Conseiller municipal</option>
                </optgroup>
                <optgroup label="Services">
                  <option value="dgs">Directeur Général des Services</option>
                  <option value="secretaire">Secrétaire de mairie</option>
                  <option value="agent">Agent territorial</option>
                </optgroup>
                <optgroup label="Citoyens">
                  <option value="citoyen">Administré</option>
                </optgroup>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="civiq-field-label">Commune rattachée</label>
            <select value={communeId} onChange={(e) => setCommuneId(e.target.value)} className="civiq-input">
              <option value="">— Aucune —</option>
              {communes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {error && <div className="modal-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button type="button" onClick={onClose} className="civiq-btn civiq-btn-secondary">Annuler</button>
          <button type="button" onClick={save} disabled={saving} className="civiq-btn civiq-btn-dark">
            {saving ? "Sauvegarde…" : <><Save size={15} /> Enregistrer</>}
          </button>
        </div>

        <style>{`
          .modal-backdrop {
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 100;
            padding: 20px;
          }
          .modal {
            background: #fff;
            border-radius: 16px;
            max-width: 520px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: var(--civiq-shadow-xl);
          }
          .modal-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--civiq-border);
          }
          .modal-head h2 {
            font-size: 18px;
            font-weight: 700;
            color: var(--civiq-text);
            font-family: 'Playfair Display', serif;
          }
          .modal-close {
            background: none; border: none; cursor: pointer;
            color: var(--civiq-text-soft);
            padding: 6px;
            border-radius: 8px;
          }
          .modal-close:hover { background: var(--civiq-surface-2); color: var(--civiq-text); }
          .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
          .field { display: flex; flex-direction: column; }
          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          @media (max-width: 500px) { .row { grid-template-columns: 1fr; } }
          .modal-error {
            background: #fef2f2;
            color: #991b1b;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
          }
          .modal-foot {
            padding: 16px 24px;
            border-top: 1px solid var(--civiq-border);
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
        `}</style>
      </div>
    </div>
  );
}

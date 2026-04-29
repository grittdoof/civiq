"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Boxes, Users, FileText, Activity, Trash2,
  X, UserPlus, Mail, Copy, Check,
} from "lucide-react";

type Role = "super_admin" | "admin" | "editor" | "viewer";

interface Commune {
  id: string;
  name: string;
  slug: string;
  code_postal?: string;
  contact_email?: string;
  primary_color?: string;
  created_at: string;
  archived_at?: string | null;
}

interface ModuleEntry {
  id: string;
  name: string;
  tagline: string;
  category: string;
  is_available: boolean;
  is_beta?: boolean;
  active: boolean;
}

interface UserEntry {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  job_title: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super-admin",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Lecteur",
};

export default function CommuneDetailPage() {
  const params = useParams();
  const communeId = params.id as string;
  const [data, setData] = useState<{
    commune: Commune;
    modules: ModuleEntry[];
    users: UserEntry[];
    survey_count: number;
    response_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  async function reload() {
    const r = await fetch(`/api/super-admin/communes/${communeId}`);
    if (!r.ok) {
      setError((await r.json()).error || "Erreur de chargement");
      setLoading(false);
      return;
    }
    setData(await r.json());
    setLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [communeId]);

  async function toggleModule(module_id: string, active: boolean) {
    setBusy(`mod:${module_id}`);
    const r = await fetch(`/api/super-admin/communes/${communeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_id, active }),
    });
    if (r.ok) await reload();
    else alert((await r.json()).error || "Erreur");
    setBusy(null);
  }

  async function changeRole(user_id: string, role: Role) {
    setBusy(`user:${user_id}`);
    const r = await fetch(`/api/super-admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, role }),
    });
    if (r.ok) await reload();
    else alert((await r.json()).error || "Erreur");
    setBusy(null);
  }

  async function detachUser(user_id: string) {
    if (!confirm("Retirer cet utilisateur de la commune ? Son compte sera conservé mais détaché.")) return;
    setBusy(`user:${user_id}`);
    const r = await fetch(`/api/super-admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, commune_id: null, role: "viewer" }),
    });
    if (r.ok) await reload();
    else alert((await r.json()).error || "Erreur");
    setBusy(null);
  }

  async function deleteUser(user_id: string, email: string | null) {
    if (!confirm(`Supprimer définitivement le compte ${email || user_id} ? Cette action est irréversible.`)) return;
    setBusy(`user:${user_id}`);
    const r = await fetch(`/api/super-admin/users?user_id=${user_id}`, { method: "DELETE" });
    if (r.ok) await reload();
    else alert((await r.json()).error || "Erreur");
    setBusy(null);
  }

  if (loading) return <main className="sa-page"><p>Chargement…</p></main>;
  if (error || !data) return <main className="sa-page"><p>{error || "Commune introuvable"}</p></main>;

  const { commune, modules, users, survey_count, response_count } = data;
  const activeModules = modules.filter((m) => m.active).length;

  return (
    <main className="sa-page">
      <Link href="/super-admin/communes" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--fg-muted)", textDecoration: "none", fontSize: 13, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Toutes les communes
      </Link>

      <header style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: commune.primary_color || "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
          {commune.name.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em", marginBottom: 4 }}>
            {commune.name}
            {commune.archived_at && <span className="civiq-badge civiq-badge-warning" style={{ marginLeft: 12 }}>Archivée</span>}
          </h1>
          <div style={{ display: "flex", gap: 14, fontSize: 13, color: "var(--fg-muted)", flexWrap: "wrap" }}>
            <span>/{commune.slug}</span>
            {commune.code_postal && <span>· {commune.code_postal}</span>}
            {commune.contact_email && <span>· {commune.contact_email}</span>}
            <span>· créée le {new Date(commune.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Kpi icon={<Boxes size={18} />} value={`${activeModules}/${modules.length}`} label="Modules actifs" />
        <Kpi icon={<Users size={18} />} value={users.length} label="Utilisateurs rattachés" />
        <Kpi icon={<FileText size={18} />} value={survey_count} label="Sondages créés" />
        <Kpi icon={<Activity size={18} />} value={response_count} label="Réponses citoyennes" />
      </div>

      {/* Modules */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Modules de cette commune</h2>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 14 }}>Activez ou désactivez chaque module à la carte.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {modules.map((m) => {
            const isBusy = busy === `mod:${m.id}`;
            return (
              <div key={m.id} className="civiq-card" style={{ padding: 16, opacity: m.is_available ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", display: "block" }}>{m.name}</strong>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span className="civiq-badge civiq-badge-muted">{m.category}</span>
                      {m.is_beta && <span className="civiq-badge civiq-badge-warning">Beta</span>}
                      {!m.is_available && <span className="civiq-badge civiq-badge-destructive">Indisponible</span>}
                    </div>
                  </div>
                  <Toggle
                    checked={m.active}
                    disabled={!m.is_available || isBusy}
                    onChange={(v) => toggleModule(m.id, v)}
                  />
                </div>
                <p style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>{m.tagline}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Users */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Utilisateurs ({users.length})</h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Gérez les rôles et accès à cette commune.</p>
          </div>
          <button type="button" onClick={() => setShowAddUser(true)} className="civiq-btn civiq-btn-default">
            <UserPlus size={14} /> Ajouter un utilisateur
          </button>
        </div>
        {users.length === 0 ? (
          <div className="civiq-card" style={{ padding: 32, textAlign: "center", borderStyle: "dashed" }}>
            <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>Aucun utilisateur rattaché à cette commune.</p>
          </div>
        ) : (
          <div className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Utilisateur", "Email", "Rôle", "Dernière connexion", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.07em", background: "var(--bg)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isBusy = busy === `user:${u.id}`;
                    return (
                      <tr key={u.id} className="civiq-table-row">
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--fg)" }}>
                          <div style={{ fontWeight: 600 }}>{u.full_name || "—"}</div>
                          {u.job_title && <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "capitalize" }}>{u.job_title}</div>}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--fg-muted)" }}>{u.email || "—"}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <select
                            value={u.role}
                            disabled={isBusy}
                            onChange={(e) => changeRole(u.id, e.target.value as Role)}
                            className="civiq-select"
                            style={{ fontSize: 12, padding: "5px 28px 5px 10px", maxWidth: 160 }}
                          >
                            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--fg-muted)" }}>
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "Jamais"}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" onClick={() => detachUser(u.id)} disabled={isBusy} className="civiq-icon-btn" title="Retirer de la commune">
                              <X size={14} />
                            </button>
                            <button type="button" onClick={() => deleteUser(u.id, u.email)} disabled={isBusy} className="civiq-icon-btn danger" title="Supprimer le compte">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {showAddUser && (
        <AddUserModal
          communeId={communeId}
          communeName={commune.name}
          onClose={() => setShowAddUser(false)}
          onCreated={() => { setShowAddUser(false); reload(); }}
        />
      )}

      <style>{`
        .sa-page { max-width: 1100px; margin: 0 auto; padding: 32px 28px 60px; }
      `}</style>
    </main>
  );
}

function AddUserModal({ communeId, communeName, onClose, onCreated }: {
  communeId: string; communeName: string; onClose: () => void; onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [jobTitle, setJobTitle] = useState<string>("agent");
  const [sendInvite, setSendInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [pwdCopied, setPwdCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErrorMsg(null);
    const r = await fetch("/api/super-admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName || null,
        role,
        job_title: jobTitle,
        commune_id: communeId,
        send_invite: sendInvite,
      }),
    });
    const data = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErrorMsg(data.error || "Erreur lors de la création");
      return;
    }
    if (data.temp_password) {
      // Affiche le mdp temporaire pour copie manuelle
      setTempPwd(data.temp_password);
    } else {
      onCreated();
    }
  }

  async function copyPwd() {
    if (!tempPwd) return;
    await navigator.clipboard.writeText(tempPwd);
    setPwdCopied(true);
    setTimeout(() => setPwdCopied(false), 2000);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} className="civiq-card" style={{ maxWidth: 460, width: "100%", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Ajouter un utilisateur</h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>Pour la commune « {communeName} »</p>
          </div>
          <button type="button" onClick={onClose} className="civiq-icon-btn"><X size={16} /></button>
        </div>

        {tempPwd ? (
          <>
            <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>Compte créé avec succès</div>
              <p style={{ fontSize: 13, color: "var(--fg)", marginBottom: 10, lineHeight: 1.5 }}>
                Communiquez ces identifiants à <strong>{email}</strong> par un canal sécurisé. Le mot de passe ne sera plus affiché ensuite.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <code style={{
                  flex: 1, background: "var(--card)", padding: "8px 10px", borderRadius: 6,
                  fontFamily: "ui-monospace, monospace", fontSize: 13, color: "var(--fg)", border: "1px solid var(--border)",
                }}>
                  {tempPwd}
                </code>
                <button type="button" onClick={copyPwd} className="civiq-btn civiq-btn-outline civiq-btn-sm">
                  {pwdCopied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                </button>
              </div>
            </div>
            <button type="button" onClick={onCreated} className="civiq-btn civiq-btn-default" style={{ width: "100%" }}>
              Terminé
            </button>
          </>
        ) : (
          <>
            {errorMsg && (
              <div style={{ background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="civiq-field-label">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="civiq-input" placeholder="prenom.nom@commune.fr" />
              </div>
              <div>
                <label className="civiq-field-label">Nom complet</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="civiq-input" placeholder="Jeanne Dupont" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="civiq-field-label">Rôle</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="civiq-select">
                    <option value="admin">Administrateur</option>
                    <option value="editor">Éditeur</option>
                    <option value="viewer">Lecteur</option>
                  </select>
                </div>
                <div>
                  <label className="civiq-field-label">Fonction</label>
                  <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="civiq-select">
                    <option value="maire">Maire</option>
                    <option value="adjoint">Adjoint·e</option>
                    <option value="conseiller">Conseiller·e</option>
                    <option value="dgs">DGS</option>
                    <option value="secretaire">Secrétaire</option>
                    <option value="agent">Agent</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--fg)", cursor: "pointer", padding: 10, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: sendInvite ? "var(--accent-light)" : "var(--card)" }}>
                <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={13} /> Envoyer un email d&apos;invitation
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                    {sendInvite
                      ? "L'utilisateur recevra un lien pour définir lui-même son mot de passe."
                      : "Compte créé avec un mot de passe temporaire à transmettre manuellement."}
                  </div>
                </div>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} className="civiq-btn civiq-btn-ghost">Annuler</button>
              <button type="button" onClick={submit} disabled={!email || busy} className="civiq-btn civiq-btn-default">
                {busy ? "Création…" : "Créer l'utilisateur"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="civiq-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 38,
        height: 22,
        borderRadius: 99,
        border: "none",
        background: checked ? "var(--accent)" : "var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 2px 4px oklch(0 0 0 / 0.2)",
        }}
      />
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Inbox, Building2, Plus, Check, X, Clock, Boxes } from "lucide-react";

interface CRequest {
  id: string;
  user_id: string;
  email: string | null;
  request_type: "join" | "create";
  commune_id: string | null;
  proposed_name: string | null;
  proposed_code_postal: string | null;
  proposed_email: string | null;
  requested_role: string;
  message: string | null;
  status: string;
  created_at: string;
  communes?: { name: string; slug: string } | null;
  profiles?: { full_name: string | null; job_title: string | null } | null;
}

interface ModuleOption {
  id: string;
  name: string;
  tagline: string | null;
  is_available: boolean;
  is_beta: boolean;
}

export default function RequestsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [requests, setRequests] = useState<CRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Catalogue des modules disponibles (pour la sélection à l'approbation)
  const [modules, setModules] = useState<ModuleOption[]>([]);

  // État de la modale d'approbation
  const [approving, setApproving] = useState<CRequest | null>(null);
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  // Pour un rattachement : modules actifs de la commune (null = création)
  const [communeModuleIds, setCommuneModuleIds] = useState<string[] | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/super-admin/commune-requests?status=${tab}`);
    if (r.ok) setRequests(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  useEffect(() => {
    fetch("/api/super-admin/modules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ModuleOption[]) => setModules(Array.isArray(d) ? d.filter((m) => m.is_available) : []))
      .catch(() => setModules([]));
  }, []);

  async function openApprove(req: CRequest) {
    setApproving(req);
    setRole(req.requested_role === "admin" ? "admin" : "editor");
    setCommuneModuleIds(null);

    if (req.request_type === "join" && req.commune_id) {
      // Rattachement : les modules disponibles sont ceux déjà actifs sur
      // la commune. On les précoche ; le super-admin décoche pour
      // restreindre l'accès de CET utilisateur (sans impacter les autres).
      try {
        const r = await fetch(`/api/super-admin/communes/${req.commune_id}`);
        if (r.ok) {
          const d = await r.json();
          const active: string[] = (d.modules ?? [])
            .filter((m: { active: boolean }) => m.active)
            .map((m: { id: string }) => m.id);
          setCommuneModuleIds(active);
          setSelectedModules(new Set(active));
          return;
        }
      } catch { /* repli ci-dessous */ }
    }

    // Création : catalogue complet, « surveys » précoché par défaut.
    setSelectedModules(new Set(modules.some((m) => m.id === "surveys") ? ["surveys"] : []));
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirmApprove() {
    if (!approving) return;
    setBusy(approving.id);
    const res = await fetch(`/api/super-admin/commune-requests/${approving.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "approve",
        role,
        modules: Array.from(selectedModules),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Erreur");
      return;
    }
    setApproving(null);
    load();
  }

  async function reject(req: CRequest) {
    const reason = window.prompt(`Motif de refus (visible par l'utilisateur) :`, "Demande non retenue.");
    if (reason === null) return;
    setBusy(req.id);
    const res = await fetch(`/api/super-admin/commune-requests/${req.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejection_reason: reason }),
    });
    setBusy(null);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Erreur");
      return;
    }
    load();
  }

  return (
    <main className="rq-page">
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", background: "var(--accent-light)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inbox size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em" }}>Demandes de rattachement</h1>
            <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Validez ou refusez les utilisateurs souhaitant rejoindre ou créer une commune.</p>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
        {(["pending", "approved", "rejected"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{
            padding: "10px 16px", fontSize: 13, fontWeight: 600,
            background: "transparent", border: "none",
            borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`,
            color: tab === k ? "var(--accent)" : "var(--fg-muted)",
            cursor: "pointer", marginBottom: -1, fontFamily: "inherit",
            textTransform: "capitalize",
          }}>
            {k === "pending" ? "En attente" : k === "approved" ? "Validées" : "Refusées"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--fg-muted)" }}>Chargement…</p>
      ) : requests.length === 0 ? (
        <div className="civiq-card" style={{ padding: 40, textAlign: "center", borderStyle: "dashed" }}>
          <Inbox size={32} style={{ color: "var(--fg-xmuted)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>Aucune demande dans cette catégorie.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {requests.map((req) => (
            <div key={req.id} className="civiq-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: req.request_type === "join" ? "var(--accent-light)" : "var(--success-light)", color: req.request_type === "join" ? "var(--accent)" : "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {req.request_type === "join" ? <Building2 size={16} /> : <Plus size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                      {req.profiles?.full_name || req.email || "Utilisateur"}
                      {req.email && req.profiles?.full_name && <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}> · {req.email}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                      {req.profiles?.job_title && <span style={{ textTransform: "capitalize" }}>{req.profiles.job_title} · </span>}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} /> {new Date(req.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`civiq-badge ${req.request_type === "join" ? "civiq-badge-default" : "civiq-badge-success"}`}>
                  {req.request_type === "join" ? "Rattachement" : "Création de commune"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--fg)", padding: 12, background: "var(--bg)", borderRadius: "var(--radius-sm)", marginBottom: 12 }}>
                {req.request_type === "join" ? (
                  <div><strong>Commune visée :</strong> {req.communes?.name || "—"} (/{req.communes?.slug || "?"})</div>
                ) : (
                  <>
                    <div><strong>Nom proposé :</strong> {req.proposed_name}</div>
                    {req.proposed_code_postal && <div><strong>Code postal :</strong> {req.proposed_code_postal}</div>}
                    {req.proposed_email && <div><strong>Email officiel :</strong> {req.proposed_email}</div>}
                  </>
                )}
                <div><strong>Rôle souhaité :</strong> {req.requested_role}</div>
                {req.message && (
                  <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <strong>Message :</strong> <em>« {req.message} »</em>
                  </div>
                )}
              </div>

              {req.status === "pending" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={busy === req.id} onClick={() => reject(req)} className="civiq-btn civiq-btn-outline">
                    <X size={14} /> Refuser
                  </button>
                  <button type="button" disabled={busy === req.id} onClick={() => openApprove(req)} className="civiq-btn civiq-btn-default">
                    <Check size={14} /> Valider
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Modale d'approbation : rôle + modules ─── */}
      {approving && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setApproving(null); }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(15,23,42,0.55)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div className="civiq-card" style={{ width: "100%", maxWidth: 480, padding: 22, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)" }}>Valider la demande</h2>
              <button type="button" onClick={() => setApproving(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 16 }}>
              {approving.request_type === "join"
                ? <>Rattachement à <strong>{approving.communes?.name}</strong></>
                : <>Création de la commune <strong>{approving.proposed_name}</strong></>}
              {" · "}{approving.profiles?.full_name || approving.email}
            </p>

            {/* Rôle */}
            <div style={{ marginBottom: 18 }}>
              <div className="civiq-field-label" style={{ marginBottom: 8 }}>Rôle attribué</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["admin", "editor"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: "var(--radius-sm)",
                      border: `1.5px solid ${role === r ? "var(--accent)" : "var(--border)"}`,
                      background: role === r ? "var(--accent-light)" : "var(--card)",
                      color: "var(--fg)", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 600, textAlign: "left",
                    }}
                  >
                    {r === "admin" ? "Administrateur" : "Éditeur"}
                    <div style={{ fontSize: 11, fontWeight: 400, color: "var(--fg-muted)", marginTop: 2 }}>
                      {r === "admin" ? "Gère l'espace et l'équipe" : "Crée et édite les contenus"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Modules */}
            <div style={{ marginBottom: 20 }}>
              <div className="civiq-field-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Boxes size={14} /> {communeModuleIds !== null ? "Modules accessibles à cet utilisateur" : "Modules à activer"}
              </div>
              {(() => {
                // Rattachement : on ne propose QUE les modules actifs de la
                // commune. Création : tout le catalogue disponible.
                const shown = communeModuleIds !== null
                  ? modules.filter((m) => communeModuleIds.includes(m.id))
                  : modules;
                return shown.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                  {communeModuleIds !== null ? "Cette commune n'a aucun module actif." : "Aucun module disponible au catalogue."}
                </p>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {shown.map((m) => {
                    const checked = selectedModules.has(m.id);
                    return (
                      <label
                        key={m.id}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "10px 12px", borderRadius: "var(--radius-sm)",
                          border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                          background: checked ? "var(--accent-light)" : "var(--card)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(m.id)}
                          style={{ marginTop: 2, accentColor: "var(--accent)" }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                            {m.name}
                            {m.is_beta && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Beta</span>}
                          </div>
                          {m.tagline && <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 1 }}>{m.tagline}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              );
              })()}
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
                {communeModuleIds !== null
                  ? "Décochez un module pour en priver cet utilisateur (les autres membres de la commune ne sont pas impactés)."
                  : "Vous pourrez modifier ces modules plus tard depuis la fiche commune."}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setApproving(null)} className="civiq-btn civiq-btn-outline">
                Annuler
              </button>
              <button type="button" disabled={busy === approving.id} onClick={confirmApprove} className="civiq-btn civiq-btn-default">
                <Check size={14} /> {busy === approving.id ? "Validation…" : "Valider et activer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.rq-page { max-width: 900px; margin: 0 auto; padding: 32px 28px 60px; }`}</style>
    </main>
  );
}

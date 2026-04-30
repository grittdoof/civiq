"use client";

import { useEffect, useState } from "react";
import { Inbox, Building2, Plus, Check, X, Mail, Clock } from "lucide-react";

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

export default function RequestsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [requests, setRequests] = useState<CRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/super-admin/commune-requests?status=${tab}`);
    if (r.ok) setRequests(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  async function approve(req: CRequest) {
    const role = window.prompt(
      `Quel rôle attribuer à ${req.email || "cet utilisateur"} ?\n\nadmin / editor / viewer`,
      req.requested_role
    );
    if (!role || !["admin", "editor", "viewer"].includes(role)) return;
    setBusy(req.id);
    const res = await fetch(`/api/super-admin/commune-requests/${req.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", role }),
    });
    setBusy(null);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Erreur");
      return;
    }
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
                  <button type="button" disabled={busy === req.id} onClick={() => approve(req)} className="civiq-btn civiq-btn-default">
                    <Check size={14} /> Valider
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`.rq-page { max-width: 900px; margin: 0 auto; padding: 32px 28px 60px; }`}</style>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2, Plus, Search, ArrowRight, Clock, CheckCircle2, AlertCircle, X,
} from "lucide-react";

interface CommuneOption {
  id: string;
  name: string;
  slug: string;
  code_postal: string | null;
}

interface PendingRequest {
  id: string;
  request_type: "join" | "create";
  status: "pending" | "rejected";
  proposed_name: string | null;
  rejection_reason: string | null;
  created_at: string;
  communes?: { name: string; slug: string } | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [communes, setCommunes] = useState<CommuneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"join" | "create">("join");

  // Form state
  const [search, setSearch] = useState("");
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [proposedName, setProposedName] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [reqRes, commRes] = await Promise.all([
      fetch("/api/commune-requests").then((r) => r.ok ? r.json() : []),
      fetch("/api/communes/public").then((r) => r.ok ? r.json() : []),
    ]);
    if (Array.isArray(reqRes) && reqRes.length) {
      // Affiche la dernière (pending ou rejected)
      setPending(reqRes[0]);
    } else {
      setPending(null);
    }
    if (Array.isArray(commRes)) setCommunes(commRes);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setErrorMsg(null);
    setSubmitting(true);
    const body = tab === "join"
      ? { request_type: "join", commune_id: selectedCommune, message }
      : {
          request_type: "create",
          proposed_name: proposedName,
          proposed_code_postal: codePostal,
          proposed_email: contactEmail,
          message,
        };
    const res = await fetch("/api/commune-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Erreur lors de l'envoi de la demande");
      return;
    }
    await load();
  }

  async function cancelRequest() {
    if (!pending || pending.status !== "pending") return;
    if (!confirm("Annuler votre demande en cours ?")) return;
    const res = await fetch(`/api/commune-requests?id=${pending.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return <main className="onb-page"><p>Chargement…</p></main>;
  }

  // ─── État : demande en cours ───
  if (pending && pending.status === "pending") {
    return (
      <main className="onb-page">
        <div className="civiq-card" style={{ padding: 32, maxWidth: 540, margin: "60px auto", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--warning-light)", color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Clock size={26} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "var(--fg)" }}>Demande en cours d&apos;examen</h1>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", marginBottom: 16, lineHeight: 1.6 }}>
            {pending.request_type === "join"
              ? <>Votre demande de rattachement à <strong>{pending.communes?.name}</strong> a été transmise à un super-administrateur.</>
              : <>Votre demande de création de la commune <strong>{pending.proposed_name}</strong> a été transmise à un super-administrateur.</>}
          </p>
          <p style={{ fontSize: 13, color: "var(--fg-xmuted)", marginBottom: 20 }}>
            Vous recevrez un email dès la décision. En attendant, vous pouvez consulter la plateforme en lecture seule.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={cancelRequest} className="civiq-btn civiq-btn-outline">
              <X size={14} /> Annuler ma demande
            </button>
            <Link href="/auth/login" className="civiq-btn civiq-btn-ghost" onClick={(e) => {
              e.preventDefault();
              fetch("/auth/logout", { method: "POST" }).finally(() => router.push("/"));
            }}>
              Me déconnecter
            </Link>
          </div>
        </div>
        <style>{onbCss}</style>
      </main>
    );
  }

  // ─── État : demande refusée → permet d'en refaire une ───
  const showRejected = pending && pending.status === "rejected";

  return (
    <main className="onb-page">
      <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em", marginBottom: 6 }}>
            Bienvenue sur GoCiviQ
          </h1>
          <p style={{ fontSize: 15, color: "var(--fg-muted)", maxWidth: 540, margin: "0 auto", lineHeight: 1.6 }}>
            Pour accéder aux fonctionnalités d&apos;administration, vous devez être rattaché·e à une commune. Choisissez l&apos;option qui vous correspond ci-dessous.
          </p>
        </div>

        {showRejected && pending && (
          <div className="civiq-card" style={{ padding: 14, background: "oklch(0.97 0.04 25)", borderColor: "var(--destructive)", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertCircle size={18} style={{ color: "var(--destructive)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: "var(--fg)" }}>
                <strong>Demande précédente refusée.</strong> {pending.rejection_reason && <em>« {pending.rejection_reason} »</em>}
                <br />Vous pouvez en soumettre une nouvelle ci-dessous.
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <button type="button" onClick={() => setTab("join")} style={tabStyle(tab === "join")}>
            <Search size={14} /> Rejoindre une commune existante
          </button>
          <button type="button" onClick={() => setTab("create")} style={tabStyle(tab === "create")}>
            <Plus size={14} /> Créer ma commune
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: "10px 14px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        {tab === "join" ? (
          <div className="civiq-card" style={{ padding: 20 }}>
            <label className="civiq-field-label">Rechercher votre commune</label>
            <input
              type="text"
              className="civiq-input"
              placeholder="Nom ou code postal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ marginTop: 12, maxHeight: 280, overflowY: "auto", display: "grid", gap: 6 }}>
              {communes
                .filter((c) =>
                  !search.trim() ||
                  c.name.toLowerCase().includes(search.toLowerCase()) ||
                  c.code_postal?.includes(search)
                )
                .slice(0, 30)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommune(c.id)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${selectedCommune === c.id ? "var(--accent)" : "var(--border)"}`,
                      background: selectedCommune === c.id ? "var(--accent-light)" : "var(--card)",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit",
                    }}
                  >
                    <Building2 size={16} style={{ color: "var(--fg-muted)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                        {c.code_postal || ""} · /{c.slug}
                      </div>
                    </div>
                    {selectedCommune === c.id && <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />}
                  </button>
                ))}
              {communes.length === 0 && (
                <p style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--fg-muted)" }}>
                  Aucune commune disponible pour le moment.
                </p>
              )}
            </div>

            <label className="civiq-field-label" style={{ marginTop: 16 }}>Message (optionnel)</label>
            <textarea
              className="civiq-input civiq-textarea"
              rows={3}
              placeholder="Expliquez votre rôle dans cette commune"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <button
              type="button"
              onClick={submit}
              disabled={!selectedCommune || submitting}
              className="civiq-btn civiq-btn-default"
              style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: "12px 22px" }}
            >
              {submitting ? "Envoi…" : <>Demander le rattachement <ArrowRight size={14} /></>}
            </button>
          </div>
        ) : (
          <div className="civiq-card" style={{ padding: 20 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="civiq-field-label">Nom de la commune *</label>
                <input type="text" className="civiq-input" value={proposedName} onChange={(e) => setProposedName(e.target.value)} placeholder="Châteauneuf" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="civiq-field-label">Code postal</label>
                  <input type="text" className="civiq-input" value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="06390" />
                </div>
                <div>
                  <label className="civiq-field-label">Email de contact</label>
                  <input type="email" className="civiq-input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="mairie@…" />
                </div>
              </div>
              <div>
                <label className="civiq-field-label">Précisions (recommandé)</label>
                <textarea
                  className="civiq-input civiq-textarea"
                  rows={3}
                  placeholder="Justifiez votre rôle (maire, DGS, élu mandaté…) pour accélérer la validation."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!proposedName.trim() || submitting}
              className="civiq-btn civiq-btn-default"
              style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: "12px 22px" }}
            >
              {submitting ? "Envoi…" : <>Demander la création <ArrowRight size={14} /></>}
            </button>
          </div>
        )}
      </div>
      <style>{onbCss}</style>
    </main>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "10px 16px", fontSize: 13, fontWeight: 600,
    background: "transparent", border: "none",
    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
    color: active ? "var(--accent)" : "var(--fg-muted)",
    cursor: "pointer", marginBottom: -1, fontFamily: "inherit",
  };
}

const onbCss = `
  .onb-page { min-height: calc(100vh - 60px); padding: 16px; background: var(--bg); }
`;

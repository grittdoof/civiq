"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2, AlertTriangle } from "lucide-react";

interface TrashedSurvey {
  id: string;
  title: string;
  slug: string;
  status: string;
  deleted_at: string;
  deleted_by: string | null;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/surveys/trash");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function restore(id: string) {
    setBusy(id);
    const res = await fetch(`/api/surveys/${id}?action=restore`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Restauration échouée");
      return;
    }
    load();
  }

  async function hardDelete(id: string, title: string) {
    if (!confirm(`Supprimer DÉFINITIVEMENT le sondage « ${title} » ? Cette action est irréversible.`)) return;
    setBusy(id);
    const res = await fetch(`/api/surveys/${id}?hard=true`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Suppression échouée");
      return;
    }
    load();
  }

  function daysLeft(deletedAt: string): number {
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, 30 - Math.floor(elapsed / (1000 * 60 * 60 * 24)));
  }

  return (
    <main className="civiq-main">
      <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={14} /> Tableau de bord
      </Link>

      <div className="civiq-page-header">
        <div>
          <h1 className="civiq-page-title">Corbeille</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
            Sondages supprimés. Restaurés ou purgés automatiquement après 30 jours.
          </p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--fg-muted)" }}>Chargement…</p>
      ) : items.length === 0 ? (
        <div className="civiq-card" style={{ textAlign: "center", padding: 48, borderStyle: "dashed" }}>
          <Trash2 size={36} style={{ color: "var(--fg-xmuted)", margin: "0 auto 12px" }} strokeWidth={1.5} />
          <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>La corbeille est vide.</p>
        </div>
      ) : (
        <div className="civiq-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Sondage", "Supprimé le", "Restauration auto.", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.07em", background: "var(--bg)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const left = daysLeft(s.deleted_at);
                  const urgent = left <= 5;
                  return (
                    <tr key={s.id} className="civiq-table-row">
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--fg)" }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>/survey/{s.slug}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--fg-muted)" }}>
                        {new Date(s.deleted_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: urgent ? "var(--destructive)" : "var(--fg-muted)" }}>
                          {urgent && <AlertTriangle size={12} />} {left} jour{left > 1 ? "s" : ""}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" disabled={busy === s.id} onClick={() => restore(s.id)} className="civiq-btn civiq-btn-outline civiq-btn-sm">
                            <RotateCcw size={13} /> Restaurer
                          </button>
                          <button type="button" disabled={busy === s.id} onClick={() => hardDelete(s.id, s.title)} className="civiq-btn civiq-btn-ghost civiq-btn-sm" style={{ color: "var(--destructive)" }}>
                            <Trash2 size={13} /> Détruire
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
    </main>
  );
}

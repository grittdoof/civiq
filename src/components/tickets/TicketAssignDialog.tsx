"use client";

import { useState } from "react";
import { X, Check, Search, UserMinus } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Modal de réassignation d'un ticket
// Utilisé dans le panel TicketActions et potentiellement depuis
// la liste (action rapide).
// ═══════════════════════════════════════════════════════════════

interface Props {
  currentAssigneId: string | null;
  agents: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  onClose: () => void;
  onAssign: (profileId: string | null) => void;
  busy?: boolean;
}

export default function TicketAssignDialog({
  currentAssigneId, agents, onClose, onAssign, busy,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = agents.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.full_name?.toLowerCase().includes(q) ?? false)
      || (a.job_title?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="civiq-card"
        style={{ width: "100%", maxWidth: 460, padding: 20 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>Assigner le ticket</h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
              Sélectionnez l&apos;agent en charge de l&apos;intervention.
            </p>
          </div>
          <button type="button" onClick={onClose} className="civiq-icon-btn"><X size={16} /></button>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un agent…"
            className="civiq-input"
            style={{ paddingLeft: 32 }}
            autoFocus
          />
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 4 }}>
          {filtered.length === 0 && (
            <p style={{ padding: 16, textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
              Aucun agent trouvé.
            </p>
          )}
          {filtered.map((a) => {
            const isCurrent = a.id === currentAssigneId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAssign(a.id)}
                disabled={busy}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px",
                  border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
                  background: isCurrent ? "var(--accent-light)" : "var(--card)",
                  borderRadius: "var(--radius-sm)",
                  cursor: busy ? "wait" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                  {(a.full_name?.[0] ?? "?").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                    {a.full_name || "(Sans nom)"}
                  </div>
                  {a.job_title && (
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "capitalize" }}>
                      {a.job_title.replace("_", " ")}
                    </div>
                  )}
                </div>
                {isCurrent && <Check size={16} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          {currentAssigneId && (
            <button
              type="button"
              onClick={() => onAssign(null)}
              disabled={busy}
              className="civiq-btn civiq-btn-ghost"
              style={{ flex: 1, justifyContent: "center", color: "var(--destructive)" }}
            >
              <UserMinus size={14} /> Désassigner
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="civiq-btn civiq-btn-outline"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

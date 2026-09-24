"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, MailX } from "lucide-react";

export interface ConvocationRow {
  member_id: string;
  name: string;
  email: string | null;
  isExternal: boolean;
  status: "pending" | "accepted" | "declined" | null;
  sent_at: string | null;
  responded_at: string | null;
  response_comment: string | null;
  last_error: string | null;
}

interface Props {
  commissionId: string;
  sessionId: string;
  rows: ConvocationRow[];
  canSend: boolean;
  /** Séance passée ou CR validé : plus d'envoi proposé */
  closed: boolean;
}

type Target = { kind: "all" | "unanswered" | "one"; memberIds: string[]; label: string; reminder: boolean };

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

// ═══════════════════════════════════════════════════════════════
// Convocations d'une séance : suivi d'envoi + réponses de présence
// (saisies par les membres depuis l'email) + (ré)envoi avec
// confirmation explicite.
// ═══════════════════════════════════════════════════════════════
export default function ConvocationsPanel({ commissionId, sessionId, rows, canSend, closed }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<Target | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reachable = rows.filter((r) => r.email);
  const neverSent = reachable.every((r) => !r.sent_at);
  const unanswered = reachable.filter((r) => r.sent_at && r.status === "pending");
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const declined = rows.filter((r) => r.status === "declined").length;
  const pending = rows.filter((r) => r.sent_at && r.status === "pending").length;

  async function send(t: Target) {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/sessions/${sessionId}/convocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: t.memberIds, reminder: t.reminder }),
      });
      const data = (await res.json().catch(() => null)) as {
        result?: { sent: unknown[]; failed: { name: string }[]; skipped: unknown[]; emailConfigured: boolean };
        error?: string;
      } | null;
      if (!res.ok || !data?.result) {
        setMessage({ ok: false, text: data?.error ?? `Envoi impossible (erreur ${res.status})` });
      } else if (!data.result.emailConfigured) {
        setMessage({ ok: false, text: "L'envoi d'emails n'est pas configuré sur la plateforme." });
      } else if (data.result.failed.length > 0) {
        setMessage({
          ok: false,
          text: `Envoyé à ${data.result.sent.length}, échec pour : ${data.result.failed.map((f) => f.name).join(", ")}`,
        });
      } else {
        setMessage({ ok: true, text: `Convocation envoyée à ${data.result.sent.length} membre(s).` });
      }
      setTarget(null);
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Connexion perdue — réessayez." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pj-convoc">
      <div className="pj-convoc-summary">
        <span className="pj-convoc-chip is-accepted"><CheckCircle2 size={14} /> {accepted} présent(s)</span>
        <span className="pj-convoc-chip is-declined"><XCircle size={14} /> {declined} excusé(s)</span>
        <span className="pj-convoc-chip is-pending"><Clock size={14} /> {pending} sans réponse</span>
      </div>

      {message && (
        <div className={message.ok ? "pj-convoc-ok" : "pj-modal-error"} role="status">{message.text}</div>
      )}

      <div className="pj-table-wrap">
        <table className="pj-table">
          <thead>
            <tr>
              <th>Membre</th>
              <th>Email</th>
              <th>Convocation</th>
              <th>Réponse</th>
              {canSend && !closed && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member_id}>
                <td data-label="Membre">
                  {r.name}
                  {r.isExternal && <span className="civiq-badge" style={{ marginLeft: 6 }}>Sans compte</span>}
                </td>
                <td data-label="Email" className="pj-table-sub">
                  {r.email ?? (
                    <span className="pj-convoc-warn"><MailX size={13} /> Aucun email</span>
                  )}
                </td>
                <td data-label="Convocation" className="pj-table-sub">
                  {r.last_error ? (
                    <span className="pj-convoc-warn"><AlertTriangle size={13} /> Échec d&apos;envoi</span>
                  ) : r.sent_at ? (
                    <>Envoyée le {fmt(r.sent_at)}</>
                  ) : (
                    "Non envoyée"
                  )}
                </td>
                <td data-label="Réponse">
                  {r.status === "accepted" && <span className="pj-convoc-chip is-accepted"><CheckCircle2 size={13} /> Présent·e</span>}
                  {r.status === "declined" && <span className="pj-convoc-chip is-declined"><XCircle size={13} /> Excusé·e</span>}
                  {(r.status === "pending" || !r.status) && <span className="pj-table-sub">—</span>}
                  {r.response_comment && <div className="pj-table-sub">« {r.response_comment} »</div>}
                </td>
                {canSend && !closed && (
                  <td>
                    {r.email && (
                      <button
                        type="button"
                        className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                        disabled={sending}
                        onClick={() => setTarget({
                          kind: "one",
                          memberIds: [r.member_id],
                          label: r.name,
                          reminder: Boolean(r.sent_at),
                        })}
                      >
                        {r.sent_at ? "Renvoyer" : "Envoyer"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canSend && !closed && reachable.length > 0 && !target && (
        <div className="pj-form-actions">
          {!neverSent && unanswered.length > 0 && (
            <button
              type="button"
              className="civiq-btn civiq-btn-outline"
              onClick={() => setTarget({
                kind: "unanswered",
                memberIds: unanswered.map((r) => r.member_id),
                label: `${unanswered.length} membre(s) sans réponse`,
                reminder: true,
              })}
            >
              Relancer les membres sans réponse ({unanswered.length})
            </button>
          )}
          <button
            type="button"
            className="civiq-btn civiq-btn-default"
            onClick={() => setTarget({
              kind: "all",
              memberIds: reachable.map((r) => r.member_id),
              label: `${reachable.length} membre(s)`,
              reminder: !neverSent,
            })}
          >
            <Send size={14} /> {neverSent ? "Envoyer la convocation" : "Renvoyer à tous"} ({reachable.length})
          </button>
        </div>
      )}

      {target && (
        <div className="pj-convoc-confirm" role="alertdialog" aria-label="Confirmer l'envoi">
          <p>
            {target.reminder ? "Envoyer un rappel de convocation" : "Envoyer la convocation"} par email à{" "}
            <strong>{target.label}</strong> ?
          </p>
          <div className="pj-form-actions">
            <button type="button" className="civiq-btn civiq-btn-ghost" onClick={() => setTarget(null)} disabled={sending}>
              Annuler
            </button>
            <button type="button" className="civiq-btn civiq-btn-default" onClick={() => send(target)} disabled={sending}>
              {sending ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
              {sending ? "Envoi…" : "Confirmer l'envoi"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

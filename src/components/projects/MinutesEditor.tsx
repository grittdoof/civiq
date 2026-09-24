"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, Lock, Loader2, Send, Mail, AlertTriangle, X } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import { toRichHtml } from "@/lib/projects/rich-text";

interface Props {
  commissionId: string;
  sessionId: string;
  initial: string;
  validated: boolean;
  canEdit: boolean;
  /** Peut envoyer le PDF par email (admin, éditeur, secrétaire) */
  canSend: boolean;
}

interface Recipient {
  member_id: string;
  name: string;
  email: string | null;
  isExternal: boolean;
  last_sent: { ok: boolean; sent_at: string } | null;
}

interface SendReport {
  sent: { name: string; email: string }[];
  failed: { name: string; email: string }[];
  skipped: { name: string }[];
}

// ═══════════════════════════════════════════════════════════════
// Éditeur de compte rendu de séance.
//
// Cycle :
//   • Brouillon : texte riche (gras, italique, souligné, titres,
//     listes), éditable par le secrétaire de séance ou un admin.
//   • Validation : verrouille le CR et propose l'envoi du PDF par
//     email aux membres choisis.
//   • Validé : lecture seule ; le PDF peut être (r)envoyé autant de
//     fois que nécessaire, aux destinataires choisis.
// ═══════════════════════════════════════════════════════════════

export default function MinutesEditor({ commissionId, sessionId, initial, validated, canEdit, canSend }: Props) {
  const router = useRouter();
  const [html, setHtml] = useState(() => toRichHtml(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"validate" | "send" | null>(null);

  const url = `/api/commissions/${commissionId}/sessions/${sessionId}/minutes`;
  const isEmpty = !html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Enregistrement impossible (erreur ${res.status})`);
        return false;
      }
      return true;
    } catch {
      setError("Connexion perdue — réessayez.");
      return false;
    }
  }

  // Le rafraîchissement (qui fait basculer l'éditeur en lecture seule
  // après validation) n'a lieu qu'à la fermeture : sinon le dialogue
  // serait démonté avant d'afficher le rapport d'envoi.
  function closeDialog() {
    setDialog(null);
    router.refresh();
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const ok = await patch({ compte_rendu: html });
    setSaving(false);
    if (ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  // ── Lecture seule (validé, ou pas les droits d'édition) ──
  if (validated || !canEdit) {
    const display = toRichHtml(initial);
    return (
      <>
        {validated && (
          <div className="pj-source-ticket" style={{ background: "var(--civiq-bg-green)" }}>
            <Lock size={14} />
            <span>Compte rendu validé et verrouillé.</span>
          </div>
        )}
        {display ? (
          // Contenu assaini à l'écriture (sanitizeRichText)
          <div className="pj-rich pj-cr-rich" dangerouslySetInnerHTML={{ __html: display }} />
        ) : (
          <p className="pj-section-empty">Compte rendu non encore rédigé.</p>
        )}
        {validated && canSend && (
          dialog === "send" ? (
            <RecipientsDialog
              commissionId={commissionId}
              sessionId={sessionId}
              mode="send"
              onClose={closeDialog}
              onValidate={async () => true}
            />
          ) : (
            <div className="pj-save-bar">
              <button type="button" className="civiq-btn civiq-btn-default civiq-btn-sm" onClick={() => setDialog("send")}>
                <Mail size={14} /> Envoyer le compte rendu par email
              </button>
            </div>
          )
        )}
      </>
    );
  }

  // ── Brouillon ──
  return (
    <>
      <RichTextEditor
        value={html}
        onChange={setHtml}
        rows={14}
        placeholder="Rédigez le compte rendu : présents, points de l'ordre du jour, délibérations, relevé de décisions, prochaine réunion…"
      />
      {error && <div className="pj-modal-error" role="alert">{error}</div>}

      {dialog === "validate" ? (
        <RecipientsDialog
          commissionId={commissionId}
          sessionId={sessionId}
          mode="validate"
          onClose={closeDialog}
          onValidate={() => patch({ compte_rendu: html, validate: true })}
        />
      ) : (
        <div className="pj-save-bar">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="civiq-btn civiq-btn-outline civiq-btn-sm"
          >
            {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
            Enregistrer le brouillon
          </button>
          <button
            type="button"
            onClick={() => setDialog("validate")}
            disabled={saving || isEmpty}
            className="civiq-btn civiq-btn-default civiq-btn-sm"
          >
            <CheckCircle2 size={14} />
            Valider &amp; verrouiller…
          </button>
          {saved && <span className="pj-save-meta">✓ Enregistré</span>}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Choix des destinataires du PDF (validation ou envoi ultérieur)
// ═══════════════════════════════════════════════════════════════
function RecipientsDialog({
  commissionId,
  sessionId,
  mode,
  onClose,
  onValidate,
}: {
  commissionId: string;
  sessionId: string;
  mode: "validate" | "send";
  onClose: () => void;
  /** Valide le CR (mode validate) ; renvoie false en cas d'échec */
  onValidate: () => Promise<boolean>;
}) {
  const sendUrl = `/api/commissions/${commissionId}/sessions/${sessionId}/minutes/send`;
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SendReport | null>(null);
  // Évite de revalider si seul l'envoi a échoué et qu'on relance
  const [validatedHere, setValidatedHere] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(sendUrl)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { recipients?: Recipient[]; error?: string } | null;
        if (cancelled) return;
        if (!res.ok || !data?.recipients) {
          setLoadError(data?.error ?? `Chargement impossible (erreur ${res.status})`);
          setRecipients([]);
          return;
        }
        setRecipients(data.recipients);
        // Par défaut : tous les membres joignables (1er envoi), ou ceux
        // qui ne l'ont pas encore reçu (envois suivants).
        const reachable = data.recipients.filter((r) => r.email);
        const notYet = reachable.filter((r) => !r.last_sent?.ok);
        setSelected(new Set((notYet.length > 0 ? notYet : reachable).map((r) => r.member_id)));
      })
      .catch(() => { if (!cancelled) { setLoadError("Connexion perdue."); setRecipients([]); } });
    return () => { cancelled = true; };
  }, [sendUrl]);

  const reachable = (recipients ?? []).filter((r) => r.email);
  const willSend = (mode === "send" || sendEmail) && selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "validate" && !validatedHere) {
        const ok = await onValidate();
        if (!ok) return;
        setValidatedHere(true);
        if (!willSend) { onClose(); return; }
      }
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: [...selected], message: message.trim() || null }),
      });
      const data = (await res.json().catch(() => null)) as { result?: SendReport; error?: string } | null;
      if (!res.ok || !data?.result) {
        setError(
          (data?.error ?? `Envoi impossible (erreur ${res.status})`) +
            (mode === "validate" ? " — le compte rendu est bien validé, vous pouvez relancer l'envoi." : ""),
        );
        return;
      }
      setReport(data.result);
    } catch {
      setError("Connexion perdue — vérifiez l'historique avant de renvoyer.");
    } finally {
      setBusy(false);
    }
  }

  if (report) {
    return (
      <div className="pj-convoc-confirm" role="status">
        {report.sent.length > 0 && <p>✓ Compte rendu envoyé à {report.sent.length} membre(s).</p>}
        {report.failed.length > 0 && (
          <p className="pj-modal-error">Échec pour : {report.failed.map((f) => `${f.name} (${f.email})`).join(", ")}</p>
        )}
        <div className="pj-form-actions">
          <button type="button" className="civiq-btn civiq-btn-default civiq-btn-sm" onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pj-convoc-confirm" role="dialog" aria-labelledby="minutes-dialog-title">
      <div className="pj-minutes-dialog-head">
        <h3 id="minutes-dialog-title">
          {mode === "validate" ? "Valider le compte rendu" : "Envoyer le compte rendu (PDF)"}
        </h3>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={onClose} disabled={busy} aria-label="Fermer">
          <X size={14} />
        </button>
      </div>

      {mode === "validate" && (
        <>
          <p className="pj-table-sub">Une fois validé, le compte rendu est verrouillé et ne peut plus être modifié.</p>
          <label className="pj-convoc-toggle">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Envoyer le PDF par email aux membres de la commission
          </label>
        </>
      )}

      {(mode === "send" || sendEmail) && (
        recipients === null ? (
          <p className="pj-table-sub"><Loader2 size={14} className="spin" /> Chargement des membres…</p>
        ) : (
          <>
            {loadError && <div className="pj-modal-error">{loadError}</div>}
            {reachable.length > 1 && (
              <div className="pj-minutes-select-all">
                <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setSelected(new Set(reachable.map((r) => r.member_id)))}>
                  Tout sélectionner
                </button>
                <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setSelected(new Set())}>
                  Aucun
                </button>
              </div>
            )}
            <ul className="pj-convoc-list">
              {recipients.map((r) => (
                <li key={r.member_id} className={!r.email ? "is-disabled" : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!r.email}
                      checked={Boolean(r.email) && selected.has(r.member_id)}
                      onChange={() => toggle(r.member_id)}
                    />
                    <span className="pj-convoc-name">
                      {r.name}
                      {r.isExternal && <span className="civiq-badge">Sans compte</span>}
                    </span>
                    <span className="pj-convoc-email">
                      {r.email ? (
                        <>
                          {r.email}
                          {r.last_sent && (
                            <span className={r.last_sent.ok ? "pj-minutes-sent" : "pj-convoc-warn"}>
                              {r.last_sent.ok ? " · envoyé le " : " · échec le "}
                              {new Date(r.last_sent.sent_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                            </span>
                          )}
                        </>
                      ) : (
                        <><AlertTriangle size={13} /> Aucun email</>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <label className="civiq-field-label" htmlFor="minutes-message">Message d&apos;accompagnement (facultatif)</label>
            <textarea
              id="minutes-message"
              className="pj-input"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex. : Vous trouverez ci-joint le compte rendu de notre dernière séance…"
            />
          </>
        )
      )}

      {error && <div className="pj-modal-error" role="alert">{error}</div>}

      <div className="pj-form-actions">
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={onClose} disabled={busy}>
          Annuler
        </button>
        <button
          type="button"
          className="civiq-btn civiq-btn-default civiq-btn-sm"
          onClick={confirm}
          disabled={busy || (mode === "send" && selected.size === 0) || recipients === null}
        >
          {busy ? <Loader2 className="spin" size={14} /> : mode === "validate" ? <CheckCircle2 size={14} /> : <Send size={14} />}
          {mode === "validate"
            ? willSend
              ? `Valider et envoyer (${selected.size})`
              : "Valider et verrouiller"
            : `Envoyer (${selected.size})`}
        </button>
      </div>
    </div>
  );
}

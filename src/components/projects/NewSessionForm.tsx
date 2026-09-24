"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Mail, AlertTriangle, ArrowLeft, Send } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface Profile { id: string; full_name: string | null; }

export interface ConvocationRecipientPreview {
  member_id: string;
  name: string;
  email: string | null;
  isExternal: boolean;
}

interface ConvocationReport {
  sent: { name: string; email: string }[];
  failed: { name: string; email: string }[];
  skipped: { name: string; reason: string }[];
  emailConfigured: boolean;
}

export default function NewSessionForm({
  commissionId,
  profiles,
  recipients,
}: {
  commissionId: string;
  profiles: Profile[];
  recipients: ConvocationRecipientPreview[];
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [lieu, setLieu] = useState("");
  const [odj, setOdj] = useState("");
  const [secretaire, setSecretaire] = useState("");
  const [sendConvocation, setSendConvocation] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.filter((r) => r.email).map((r) => r.member_id)),
  );
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<{ sessionId: string; convocation: ConvocationReport | null; error: string | null } | null>(null);

  const withoutEmail = recipients.filter((r) => !r.email);
  const selectedRecipients = recipients.filter((r) => r.email && selected.has(r.member_id));
  const willSend = sendConvocation && selectedRecipients.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || loading) return;
    // Validation explicite de l'envoi : récapitulatif des destinataires
    if (willSend && !confirming) {
      setConfirming(true);
      return;
    }
    void create();
  }

  async function create() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_seance: date,
          lieu: lieu.trim() || null,
          ordre_du_jour: odj.trim() || null,
          secretaire_de_seance_user_id: secretaire || null,
          send_convocation: willSend,
          convocation_member_ids: willSend ? selectedRecipients.map((r) => r.member_id) : null,
        }),
      });
      // Une réponse non-JSON (timeout, 502…) ne doit plus laisser le
      // bouton tourner indéfiniment.
      const data = (await res.json().catch(() => null)) as {
        session?: { id: string };
        convocation?: ConvocationReport | null;
        convocation_error?: string | null;
        error?: string;
      } | null;
      if (!res.ok || !data?.session) {
        setErr(data?.error ?? `La séance n'a pas pu être créée (erreur ${res.status}). Réessayez.`);
        setConfirming(false);
        return;
      }
      const conv = data.convocation ?? null;
      const allGood =
        !willSend ||
        (conv && conv.emailConfigured && conv.failed.length === 0 && !data.convocation_error);
      if (allGood) {
        router.push(`/admin/commissions/${commissionId}/sessions/${data.session.id}`);
        router.refresh();
        return;
      }
      setReport({ sessionId: data.session.id, convocation: conv, error: data.convocation_error ?? null });
    } catch {
      setErr("Connexion perdue pendant la création. Vérifiez la liste des séances avant de réessayer.");
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  // ── Rapport d'envoi partiel / en échec ──
  if (report) {
    const c = report.convocation;
    return (
      <div className="civiq-card pj-section pj-section-wide">
        <h2 className="pj-section-title">Séance créée</h2>
        {report.error && <div className="pj-modal-error">L&apos;envoi des convocations a échoué : {report.error}</div>}
        {c && !c.emailConfigured && (
          <div className="pj-modal-error">L&apos;envoi d&apos;emails n&apos;est pas configuré sur la plateforme : aucune convocation n&apos;est partie.</div>
        )}
        {c && c.sent.length > 0 && <p>✓ Convocation envoyée à {c.sent.length} membre(s).</p>}
        {c && c.failed.length > 0 && (
          <p className="pj-modal-error">
            Échec d&apos;envoi pour : {c.failed.map((f) => `${f.name} (${f.email})`).join(", ")}
          </p>
        )}
        <p className="pj-table-sub">Vous pouvez relancer l&apos;envoi depuis la page de la séance.</p>
        <div className="pj-form-actions">
          <button
            type="button"
            className="civiq-btn civiq-btn-default"
            onClick={() => {
              router.push(`/admin/commissions/${commissionId}/sessions/${report.sessionId}`);
              router.refresh();
            }}
          >
            Ouvrir la séance
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="pj-form">
      <div className="civiq-card pj-section pj-section-wide">
        <div className="pj-form-grid">
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="d">Date et heure de la séance *</label>
            <input
              id="d"
              type="datetime-local"
              className="pj-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="pj-form-field">
            <label className="civiq-field-label" htmlFor="l">Lieu</label>
            <input
              id="l"
              className="pj-input"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Salle du conseil…"
            />
          </div>
          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label">Ordre du jour</label>
            <RichTextEditor
              value={odj}
              onChange={setOdj}
              placeholder="Rédigez l'ordre du jour : titres, listes à puces ou numérotées, gras…"
              rows={6}
            />
          </div>
          <div className="pj-form-field pj-form-field-wide">
            <label className="civiq-field-label" htmlFor="sec">Secrétaire de séance</label>
            <select
              id="sec"
              className="pj-input"
              value={secretaire}
              onChange={(e) => setSecretaire(e.target.value)}
            >
              <option value="">— À désigner —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Convocation par email ── */}
      <div className="civiq-card pj-section pj-section-wide">
        <h2 className="pj-section-title"><Mail size={16} /> Convocation par email</h2>
        <label className="pj-convoc-toggle">
          <input
            type="checkbox"
            checked={sendConvocation}
            onChange={(e) => { setSendConvocation(e.target.checked); setConfirming(false); }}
          />
          Envoyer la convocation par email aux membres (ordre du jour, ajout à l&apos;agenda, réponse de présence)
        </label>

        {sendConvocation && (
          recipients.length === 0 ? (
            <p className="pj-section-empty">Cette commission n&apos;a encore aucun membre.</p>
          ) : (
            <ul className="pj-convoc-list">
              {recipients.map((r) => (
                <li key={r.member_id} className={!r.email ? "is-disabled" : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!r.email}
                      checked={Boolean(r.email) && selected.has(r.member_id)}
                      onChange={() => { toggle(r.member_id); setConfirming(false); }}
                    />
                    <span className="pj-convoc-name">
                      {r.name}
                      {r.isExternal && <span className="civiq-badge">Sans compte</span>}
                    </span>
                    <span className="pj-convoc-email">
                      {r.email ?? (
                        <><AlertTriangle size={13} /> Aucun email — à renseigner dans la commission</>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )
        )}
        {sendConvocation && withoutEmail.length > 0 && (
          <p className="pj-table-sub">
            {withoutEmail.length} membre(s) sans adresse email ne recevront pas la convocation.
          </p>
        )}
      </div>

      {err && <div className="pj-modal-error">{err}</div>}

      {confirming && willSend ? (
        <div className="civiq-card pj-section pj-section-wide pj-convoc-confirm" role="alertdialog" aria-labelledby="convoc-confirm-title">
          <h2 id="convoc-confirm-title" className="pj-section-title">Confirmer l&apos;envoi</h2>
          <p>
            La convocation va être envoyée par email à <strong>{selectedRecipients.length} membre(s)</strong> :{" "}
            {selectedRecipients.map((r) => r.name).join(", ")}.
          </p>
          <div className="pj-form-actions">
            <button type="button" className="civiq-btn civiq-btn-ghost" onClick={() => setConfirming(false)} disabled={loading}>
              <ArrowLeft size={14} /> Modifier
            </button>
            <button type="submit" className="civiq-btn civiq-btn-default" disabled={loading}>
              {loading ? <Loader2 className="spin" size={14} /> : <Send size={14} />}
              {loading ? "Création et envoi…" : "Confirmer et envoyer"}
            </button>
          </div>
        </div>
      ) : (
        <div className="pj-form-actions">
          <button type="submit" disabled={loading || !date} className="civiq-btn civiq-btn-default">
            {loading ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
            {willSend ? `Planifier & convoquer (${selectedRecipients.length})` : "Planifier la séance"}
          </button>
        </div>
      )}
    </form>
  );
}

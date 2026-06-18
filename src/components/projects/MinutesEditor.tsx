"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, Lock, Loader2 } from "lucide-react";

interface Props {
  commissionId: string;
  sessionId: string;
  initial: string;
  validated: boolean;
  canEdit: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Éditeur de compte rendu de séance.
//
// Cycle :
//   • Brouillon : éditable par le secrétaire de séance ou un admin
//   • Validé : verrouillé, exportable en PDF, notif aux membres
//
// Seul le secrétaire (ou admin) peut éditer/valider.
// ═══════════════════════════════════════════════════════════════

export default function MinutesEditor({ commissionId, sessionId, initial, validated, canEdit }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saved, setSaved] = useState(false);

  const url = `/api/commissions/${commissionId}/sessions/${sessionId}/minutes`;

  async function save() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compte_rendu: text }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function validate() {
    if (!confirm("Valider le compte rendu ? Il sera verrouillé et notifié aux membres.")) return;
    setValidating(true);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compte_rendu: text, validate: true }),
    });
    setValidating(false);
    if (res.ok) {
      router.refresh();
    }
  }

  if (validated || !canEdit) {
    return (
      <>
        {validated && (
          <div className="pj-source-ticket" style={{ background: "var(--civiq-bg-green)" }}>
            <Lock size={14} />
            <span>Compte rendu validé et verrouillé.</span>
          </div>
        )}
        {text ? (
          <pre className="pj-cr-readonly">{text}</pre>
        ) : (
          <p className="pj-section-empty">Compte rendu non encore rédigé.</p>
        )}
      </>
    );
  }

  return (
    <>
      <textarea
        rows={14}
        className="pj-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Rédigez le compte rendu de la séance…

Présents : …
Excusés / absents : …

1. Ordre du jour
2. Délibérations / avis
3. Relevé de décisions
4. Prochaine réunion"
      />
      <div className="pj-save-bar">
        <button
          type="button"
          onClick={save}
          disabled={saving || validating}
          className="civiq-btn civiq-btn-outline civiq-btn-sm"
        >
          {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
          Enregistrer le brouillon
        </button>
        <button
          type="button"
          onClick={validate}
          disabled={saving || validating || !text.trim()}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
        >
          {validating ? <Loader2 className="spin" size={14} /> : <CheckCircle2 size={14} />}
          Valider &amp; verrouiller
        </button>
        {saved && <span className="pj-save-meta">✓ Enregistré</span>}
      </div>
    </>
  );
}

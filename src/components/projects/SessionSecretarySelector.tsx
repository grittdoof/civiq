"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserCog } from "lucide-react";

interface Profile { id: string; full_name: string | null; }

interface Props {
  commissionId: string;
  sessionId: string;
  /** Profils éligibles : conseillers de la commission ayant un compte
   *  GoCiviq (les externes ne peuvent pas être secrétaire car ils
   *  n'éditent rien). */
  candidates: Profile[];
  current: string | null;
  /** Nom courant à afficher (peut être un externe — read-only auquel cas) */
  currentName: string | null;
  canEdit: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SessionSecretarySelector — Désignation du secrétaire de séance
// directement depuis la fiche séance (pas seulement à la création).
// PATCH /api/commissions/:id/sessions/:sid {secretaire_de_seance_user_id}
// ═══════════════════════════════════════════════════════════════

export default function SessionSecretarySelector({
  commissionId, sessionId, candidates, current, currentName, canEdit,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(newValue: string) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/commissions/${commissionId}/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretaire_de_seance_user_id: newValue || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erreur");
    }
  }

  if (!canEdit) {
    return (
      <div className="pj-secretary-display">
        <UserCog size={14} />
        <span className="pj-table-sub">Secrétaire :</span>
        <strong>{currentName ?? "À désigner"}</strong>
      </div>
    );
  }

  return (
    <div className="pj-secretary-inline">
      <label className="pj-secretary-label">
        <UserCog size={14} />
        <span>Secrétaire de séance :</span>
      </label>
      <select
        className="pj-input pj-input-inline"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          save(e.target.value);
        }}
        disabled={saving}
        style={{ minWidth: 200 }}
      >
        <option value="">— À désigner —</option>
        {candidates.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
        ))}
      </select>
      {saving && <Loader2 className="spin" size={14} />}
      {saved && <Check size={14} style={{ color: "var(--civiq-success)" }} />}
      {error && <span style={{ fontSize: 12, color: "var(--civiq-warning)" }}>{error}</span>}
    </div>
  );
}

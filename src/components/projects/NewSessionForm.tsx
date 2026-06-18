"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface Profile { id: string; full_name: string | null; }

export default function NewSessionForm({ commissionId, profiles }: { commissionId: string; profiles: Profile[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [lieu, setLieu] = useState("");
  const [odj, setOdj] = useState("");
  const [secretaire, setSecretaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/commissions/${commissionId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date_seance: date,
        lieu: lieu.trim() || null,
        ordre_du_jour: odj.trim() || null,
        secretaire_de_seance_user_id: secretaire || null,
      }),
    });
    const data = (await res.json()) as { session?: { id: string }; error?: string };
    setLoading(false);
    if (!res.ok) {
      setErr(data.error ?? "Erreur");
      return;
    }
    router.push(`/admin/commissions/${commissionId}/sessions/${data.session!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="pj-form">
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

      {err && <div className="pj-modal-error">{err}</div>}

      <div className="pj-form-actions">
        <button type="submit" disabled={loading || !date} className="civiq-btn civiq-btn-default">
          {loading ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
          Planifier &amp; convoquer
        </button>
      </div>
    </form>
  );
}

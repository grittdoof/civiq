"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import { lireReponse } from "@/lib/storage/televerser";

// ═══════════════════════════════════════════════════════════════
// SessionInfosEditor — modifier la date, le lieu et l'ordre du jour
// d'une séance après sa création (lieu oublié, salle changée…).
// Si la convocation est déjà partie, propose de prévenir les membres
// avec une « convocation modifiée » (leurs réponses sont conservées).
// ═══════════════════════════════════════════════════════════════

interface Props {
  commissionId: string;
  sessionId: string;
  /** date_seance : heure murale stockée dans les composantes UTC. */
  dateSeance: string;
  lieu: string | null;
  ordreDuJour: string | null;
  /** Membres ayant déjà reçu la convocation. */
  convoques: string[];
  locked: boolean;
}

/** « 2026-11-30T19:30:00+00:00 » → « 2026-11-30T19:30 » (convention date murale en UTC). */
function versSaisie(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
}

export default function SessionInfosEditor({ commissionId, sessionId, dateSeance, lieu, ordreDuJour, convoques, locked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(versSaisie(dateSeance));
  const [place, setPlace] = useState(lieu ?? "");
  const [odj, setOdj] = useState(ordreDuJour ?? "");
  const [prevenir, setPrevenir] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (locked) return null;

  function ouvrir() {
    setDate(versSaisie(dateSeance));
    setPlace(lieu ?? "");
    setOdj(ordreDuJour ?? "");
    setPrevenir(true);
    setError(null);
    setMessage(null);
    setOpen(true);
  }

  const modifie =
    date !== versSaisie(dateSeance) ||
    place.trim() !== (lieu ?? "").trim() ||
    odj.trim() !== (ordreDuJour ?? "").trim();

  async function enregistrer() {
    if (!date || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/commissions/${commissionId}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_seance: date, lieu: place.trim() || null, ordre_du_jour: odj.trim() || null }),
      });
      const d = await lireReponse(res);
      if (!res.ok || d.error) throw new Error(d.error ?? "La séance n'a pas été modifiée.");

      let info = "Séance mise à jour.";
      if (prevenir && convoques.length > 0) {
        const r = await fetch(`/api/commissions/${commissionId}/sessions/${sessionId}/convocations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_ids: convoques, update: true }),
        });
        const data = (await r.json().catch(() => ({}))) as { result?: { sent: unknown[]; failed: unknown[] }; error?: string };
        if (!r.ok || !data.result) {
          info = "Séance mise à jour, mais la convocation modifiée n'a pas pu être envoyée. Renvoyez-la depuis « Convocations ».";
        } else {
          const n = data.result.sent.length;
          info = n > 0
            ? `Séance mise à jour. Convocation modifiée envoyée à ${n} membre${n > 1 ? "s" : ""}.`
            : "Séance mise à jour, mais aucune convocation modifiée n'est partie. Renvoyez-la depuis « Convocations ».";
        }
      }
      setOpen(false);
      setMessage(info);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="pj-session-infos">
        <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={ouvrir}>
          <Pencil size={14} /> Modifier la date, le lieu ou l&apos;ordre du jour
        </button>
        {message && <p className="pj-session-infos-msg" role="status">{message}</p>}
      </div>
    );
  }

  return (
    <div className="civiq-card pj-session-infos-form">
      <div className="pj-session-infos-field">
        <label className="civiq-field-label" htmlFor="si-date">Date et heure *</label>
        <input id="si-date" type="datetime-local" className="pj-input" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="pj-session-infos-field">
        <label className="civiq-field-label" htmlFor="si-lieu">Lieu</label>
        <input id="si-lieu" className="pj-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Salle du conseil, mairie" />
      </div>
      <div className="pj-session-infos-field">
        <span className="civiq-field-label">Ordre du jour</span>
        <RichTextEditor value={odj} onChange={setOdj} placeholder="Ordre du jour de la séance" />
      </div>
      {convoques.length > 0 && (
        <label className="pj-checkbox">
          <input type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} />
          <span>
            Prévenir les {convoques.length} membre{convoques.length > 1 ? "s" : ""} déjà convoqué{convoques.length > 1 ? "s" : ""} (convocation modifiée ; leurs réponses sont conservées)
          </span>
        </label>
      )}
      {error && <p className="pj-modal-error" role="alert">{error}</p>}
      <div className="pj-add-form-actions">
        <button type="button" className="civiq-btn civiq-btn-default civiq-btn-sm" onClick={enregistrer} disabled={saving || !date || !modifie}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={() => setOpen(false)} disabled={saving}>
          Annuler
        </button>
      </div>
    </div>
  );
}

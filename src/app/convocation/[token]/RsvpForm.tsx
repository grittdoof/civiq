"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

type Status = "pending" | "accepted" | "declined";

interface Props {
  token: string;
  initialStatus: Status;
  initialComment: string;
  /** Choix présélectionné depuis le bouton de l'email */
  intent: "accepted" | "declined" | null;
  closed: boolean;
}

const LABELS: Record<Status, string> = {
  pending: "Pas encore de réponse",
  accepted: "Vous avez confirmé votre présence.",
  declined: "Vous avez indiqué ne pas pouvoir venir.",
};

export default function RsvpForm({ token, initialStatus, initialComment, intent, closed }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(
    intent ?? (initialStatus === "pending" ? null : initialStatus),
  );
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function submit() {
    if (!choice || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/convocations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: choice, comment }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setStatus(choice);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (closed) {
    return (
      <section className="cv-rsvp">
        <p className={`cv-status cv-status-${status}`}>
          {status === "pending" ? "Cette séance est passée ou clôturée." : LABELS[status]}
        </p>
      </section>
    );
  }

  return (
    <section className="cv-rsvp">
      <h2>Votre présence</h2>
      {status !== "pending" && (
        <p className={`cv-status cv-status-${status}`} role="status">
          {justSaved ? "✓ Réponse enregistrée. " : ""}
          {LABELS[status]}
        </p>
      )}
      <div className="cv-choices" role="radiogroup" aria-label="Votre présence">
        <button
          type="button"
          role="radio"
          aria-checked={choice === "accepted"}
          className={`cv-choice cv-choice-accept${choice === "accepted" ? " is-on" : ""}`}
          onClick={() => { setChoice("accepted"); setJustSaved(false); }}
        >
          <Check size={18} aria-hidden /> Je serai présent·e
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={choice === "declined"}
          className={`cv-choice cv-choice-decline${choice === "declined" ? " is-on" : ""}`}
          onClick={() => { setChoice("declined"); setJustSaved(false); }}
        >
          <X size={18} aria-hidden /> Je ne pourrai pas venir
        </button>
      </div>
      <label className="cv-comment-label" htmlFor="cv-comment">
        Message (facultatif)
      </label>
      <textarea
        id="cv-comment"
        className="cv-comment"
        rows={2}
        maxLength={500}
        value={comment}
        onChange={(e) => { setComment(e.target.value); setJustSaved(false); }}
        placeholder={choice === "declined" ? "Motif, pouvoir donné à…" : "Précision éventuelle"}
      />
      {error && <p className="cv-error" role="alert">{error}</p>}
      <button
        type="button"
        className="cv-submit"
        disabled={!choice || saving || (justSaved && choice === status)}
        onClick={submit}
      >
        {saving && <Loader2 size={16} className="spin" aria-hidden />}
        {status === "pending" ? "Envoyer ma réponse" : "Mettre à jour ma réponse"}
      </button>
    </section>
  );
}

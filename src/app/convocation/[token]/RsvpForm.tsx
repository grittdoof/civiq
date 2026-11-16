"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

type Status = "pending" | "accepted" | "declined";
type Choice = "accepted" | "declined";

interface Props {
  token: string;
  initialStatus: Status;
  initialComment: string;
  /** Réponse choisie dans l'email (« Je serai présent·e » / « Je ne pourrai pas venir »). */
  intent: Choice | null;
  closed: boolean;
}

const CONFIRMATION: Record<Choice, string> = {
  accepted: "Merci, nous vous confirmons votre présence.",
  declined: "Nous avons bien pris en compte votre absence.",
};

const LABELS: Record<Status, string> = {
  pending: "Pas encore de réponse",
  accepted: "Vous avez confirmé votre présence.",
  declined: "Vous avez indiqué ne pas pouvoir venir.",
};

/**
 * Réponse à une convocation.
 *
 * Arrivée depuis un bouton de l'email (`intent`) : la réponse est
 * enregistrée aussitôt, par le navigateur, puis confirmée. L'enregistrement
 * se fait en JavaScript et non à l'ouverture du lien côté serveur : les
 * antivirus de messagerie qui pré-ouvrent les liens n'exécutent pas la page
 * et ne peuvent donc pas répondre à la place de l'élu.
 */
export default function RsvpForm({ token, initialStatus, initialComment, intent, closed }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [auto, setAuto] = useState<"idle" | "saving" | "done" | "failed">(intent && !closed ? "saving" : "idle");
  const [choice, setChoice] = useState<Choice | null>(intent ?? (initialStatus === "pending" ? null : initialStatus));
  const [comment, setComment] = useState(initialComment);
  const [savedComment, setSavedComment] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const lance = useRef(false);

  async function envoyer(next: Choice, withComment?: string): Promise<boolean> {
    const res = await fetch(`/api/convocations/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withComment === undefined ? { status: next } : { status: next, comment: withComment }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Votre réponse n'a pas pu être enregistrée.");
    setStatus(next);
    setChoice(next);
    if (withComment !== undefined) setSavedComment(withComment);
    return true;
  }

  // Enregistrement automatique de la réponse choisie dans l'email.
  useEffect(() => {
    if (!intent || closed || lance.current) return;
    lance.current = true;
    (async () => {
      try {
        if (initialStatus !== intent) await envoyer(intent);
        setAuto("done");
        // Retire ?reponse= de l'adresse : un rechargement ne rejoue rien.
        try { window.history.replaceState(null, "", window.location.pathname); } catch { /* sans effet */ }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
        setAuto("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!choice || saving) return;
    setSaving(true);
    setError(null);
    try {
      await envoyer(choice, comment);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function changerAvis() {
    if (status === "pending" || saving) return;
    const next: Choice = status === "accepted" ? "declined" : "accepted";
    setSaving(true);
    setError(null);
    try {
      await envoyer(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function envoyerMessage() {
    if (status === "pending" || saving) return;
    setSaving(true);
    setError(null);
    try {
      await envoyer(status, comment);
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

  // ── Arrivée depuis l'email : enregistrement puis confirmation ──
  if (auto === "saving") {
    return (
      <section className="cv-rsvp cv-confirm" aria-live="polite">
        <p className="cv-confirm-wait"><Loader2 size={18} className="spin" aria-hidden /> Enregistrement de votre réponse…</p>
      </section>
    );
  }

  if (auto === "done" && status !== "pending") {
    const accepte = status === "accepted";
    return (
      <section className={`cv-rsvp cv-confirm cv-confirm-${status}`} aria-live="polite">
        <div className="cv-confirm-icon" aria-hidden>{accepte ? <Check size={28} /> : <X size={28} />}</div>
        <p className="cv-confirm-title" role="status">{CONFIRMATION[status]}</p>
        {accepte && <p className="cv-confirm-sub">Retrouvez ci-dessous la date, le lieu et l&apos;ordre du jour.</p>}

        <label className="cv-comment-label" htmlFor="cv-comment">
          {accepte ? "Une précision à transmettre ? (facultatif)" : "Un message à transmettre ? Motif, pouvoir donné à… (facultatif)"}
        </label>
        <textarea
          id="cv-comment"
          className="cv-comment"
          rows={2}
          maxLength={500}
          value={comment}
          onChange={(e) => { setComment(e.target.value); setJustSaved(false); }}
        />
        {error && <p className="cv-error" role="alert">{error}</p>}
        {(comment.trim() !== savedComment.trim() || justSaved) && (
          <button
            type="button"
            className="cv-submit"
            disabled={saving || comment.trim() === savedComment.trim()}
            onClick={envoyerMessage}
          >
            {saving && <Loader2 size={16} className="spin" aria-hidden />}
            {justSaved && comment.trim() === savedComment.trim() ? "✓ Message envoyé" : "Envoyer le message"}
          </button>
        )}

        <p className="cv-change">
          {accepte ? "Un empêchement ?" : "Finalement disponible ?"}{" "}
          <button type="button" className="cv-change-btn" onClick={changerAvis} disabled={saving}>
            {accepte ? "Je ne pourrai pas venir" : "Je serai présent·e"}
          </button>
        </p>
      </section>
    );
  }

  // ── Formulaire (lien sans réponse choisie, ou échec de l'enregistrement) ──
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

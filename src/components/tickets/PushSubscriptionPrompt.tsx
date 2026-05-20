"use client";

import { useEffect, useState } from "react";
import { Bell, Smartphone, Share, Plus, CheckCircle2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

// ═══════════════════════════════════════════════════════════════
// PushSubscriptionPrompt
//
// Modal pleine page bloquante affichée à chaque session tant que
// l'utilisateur n'a pas activé les notifications (ou explicitement
// reporté pour la session). Indispensable pour les agents qui
// reçoivent des assignations de tickets.
//
// Cas spécial iOS : si l'app n'est pas installée en PWA, on
// affiche un guide pour l'ajouter à l'écran d'accueil.
// ═══════════════════════════════════════════════════════════════

// Dismiss par session uniquement (pas localStorage). À chaque
// nouvelle session de l'app, on redemande tant que pas souscrit.
const SESSION_DISMISS_KEY = "tickets:push:dismissed-session";

export default function PushSubscriptionPrompt() {
  const { status, subscribe } = usePushSubscription();
  const [dismissedSession, setDismissedSession] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedSession(sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");
  }, []);

  function dismissForSession() {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissedSession(true);
  }

  // Pas d'affichage si :
  // - en cours de chargement
  // - déjà souscrit
  // - non supporté (desktop sans push, etc.)
  // - reporté pour cette session
  if (status === "loading" || status === "subscribed" || status === "unsupported") {
    return null;
  }
  if (dismissedSession) return null;

  const isIos = status === "ios-pwa-required";
  const isDenied = status === "denied";

  return (
    <div className="tk-push-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tk-push-title">
      <div className="tk-push-modal">
        <div className="tk-push-modal-icon">
          {isIos ? <Smartphone size={32} /> : <Bell size={32} />}
        </div>

        <h2 id="tk-push-title" className="tk-push-modal-title">
          {isIos
            ? "Installer GoCiviq sur votre iPhone"
            : isDenied
              ? "Notifications bloquées"
              : "Activez les notifications"}
        </h2>

        <p className="tk-push-modal-desc">
          {isIos
            ? "Pour recevoir les notifications de tickets en temps réel, vous devez d'abord ajouter GoCiviq à votre écran d'accueil."
            : isDenied
              ? "Vous avez précédemment refusé les notifications. Réactivez-les depuis les réglages de votre navigateur ou de votre téléphone pour ne plus rater une assignation."
              : "Recevez les nouveaux tickets et les assignations en temps réel sur votre téléphone, même quand l'application est fermée. Indispensable pour les agents de terrain."}
        </p>

        {isIos && (
          <ol className="tk-push-modal-steps">
            <li>
              Tapez <Share size={14} style={{ verticalAlign: "middle" }} /> <strong>Partager</strong> dans Safari
            </li>
            <li>
              Puis <Plus size={14} style={{ verticalAlign: "middle" }} /> <strong>« Sur l&apos;écran d&apos;accueil »</strong>
            </li>
            <li>Rouvrez l&apos;app depuis l&apos;icône installée, puis reconnectez-vous</li>
          </ol>
        )}

        {isDenied && (
          <div className="tk-push-modal-help">
            <strong>Sur iPhone :</strong> Réglages → Notifications → GoCiviq → Autoriser.<br />
            <strong>Sur ordinateur :</strong> cadenas dans la barre d&apos;adresse → Notifications → Autoriser.
          </div>
        )}

        <div className="tk-push-modal-actions">
          {!isIos && !isDenied && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                await subscribe();
                setBusy(false);
              }}
              disabled={busy}
              className="tk-push-modal-cta"
            >
              <Bell size={16} />
              {busy ? "Activation…" : "Activer les notifications"}
            </button>
          )}

          <button
            type="button"
            onClick={dismissForSession}
            className="tk-push-modal-skip"
          >
            {isIos || isDenied ? "Continuer pour cette session" : "Plus tard"}
          </button>
        </div>

        <p className="tk-push-modal-footnote">
          <CheckCircle2 size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Vous pourrez modifier ce choix à tout moment dans <strong>Profil → Notifications</strong>.
        </p>
      </div>

      <style>{`
        .tk-push-modal-overlay {
          position: fixed;
          inset: 0;
          background: oklch(0 0 0 / 0.55);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: tk-push-fade 0.2s ease-out;
        }
        .tk-push-modal {
          background: var(--card, #fff);
          border-radius: 18px;
          padding: 28px 24px 20px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 24px 60px oklch(0 0 0 / 0.3);
          animation: tk-push-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-height: 90vh;
          overflow-y: auto;
        }
        @keyframes tk-push-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes tk-push-pop {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .tk-push-modal-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: var(--accent-light, #fce8e9);
          color: var(--accent, #ff5a5f);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tk-push-modal-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--fg, #1a2744);
          margin-bottom: 10px;
          line-height: 1.25;
        }
        .tk-push-modal-desc {
          font-size: 14px;
          color: var(--fg-muted, #666);
          line-height: 1.55;
          margin-bottom: 18px;
        }
        .tk-push-modal-steps {
          text-align: left;
          font-size: 14px;
          color: var(--fg, #1a2744);
          line-height: 1.7;
          padding: 14px 16px 14px 32px;
          background: var(--bg-soft, #faf9f6);
          border-radius: 10px;
          margin: 0 0 18px;
        }
        .tk-push-modal-help {
          text-align: left;
          font-size: 13px;
          color: var(--fg, #1a2744);
          line-height: 1.6;
          padding: 12px 14px;
          background: var(--bg-soft, #faf9f6);
          border-radius: 10px;
          margin-bottom: 18px;
        }
        .tk-push-modal-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }
        .tk-push-modal-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1a2744, #3b6fa0);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .tk-push-modal-cta:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(26,39,68,0.25);
        }
        .tk-push-modal-cta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .tk-push-modal-skip {
          background: transparent;
          border: none;
          color: var(--fg-muted, #888);
          font-size: 13px;
          font-weight: 500;
          padding: 8px;
          cursor: pointer;
          font-family: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .tk-push-modal-skip:hover { color: var(--fg, #1a2744); }
        .tk-push-modal-footnote {
          font-size: 11px;
          color: var(--fg-xmuted, #aaa);
          line-height: 1.5;
          padding-top: 10px;
          border-top: 1px solid var(--border-light, #f0ede5);
        }
      `}</style>
    </div>
  );
}

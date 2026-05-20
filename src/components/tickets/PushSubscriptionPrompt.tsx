"use client";

import { useEffect, useState } from "react";
import { Bell, Smartphone, Share, Plus, CheckCircle2, MoreHorizontal, ChevronDown, AppWindow, Sparkles } from "lucide-react";
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

// ─── Composant : animation des étapes d'installation iPhone ───
function IosInstallSteps() {
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActiveStep((s) => (s + 1) % 4), 2200);
    return () => clearInterval(id);
  }, []);

  const steps = [
    {
      title: (
        <>
          Tapez sur{" "}
          <span className="tk-ios-step-icon"><MoreHorizontal size={14} /></span>
          {" "}<strong>en bas à droite</strong> de Safari
        </>
      ),
      hint: "Le menu Safari (icône trois petits points) doit s'ouvrir.",
    },
    {
      title: (
        <>
          Choisissez{" "}
          <span className="tk-ios-step-icon"><Share size={13} /></span>
          {" "}<strong>Partager</strong>
        </>
      ),
      hint: "La feuille de partage iOS apparaît.",
    },
    {
      title: (
        <>
          Faites défiler vers le bas et tapez{" "}
          <strong>« En voir plus »</strong>{" "}
          <span className="tk-ios-step-icon"><ChevronDown size={13} /></span>
        </>
      ),
      hint: "Vous accédez à la liste complète des actions iOS.",
    },
    {
      title: (
        <>
          Choisissez{" "}
          <span className="tk-ios-step-icon"><Plus size={13} /></span>
          {" "}<strong>« Sur l&apos;écran d&apos;accueil »</strong>
        </>
      ),
      hint: (
        <>
          Sur l&apos;écran de prévisualisation, vérifiez bien que{" "}
          <span className="tk-ios-step-icon"><AppWindow size={12} /></span>
          {" "}<strong>« Ouvrir comme une app web »</strong> est{" "}
          <span className="tk-ios-step-checkbox">✓ activé</span>, puis tapez{" "}
          <strong>Ajouter</strong>. Rouvrez ensuite GoCiviq depuis l&apos;icône installée sur votre écran d&apos;accueil et reconnectez-vous.
        </>
      ),
    },
  ];

  return (
    <ol className="tk-ios-steps">
      {steps.map((s, i) => (
        <li key={i} className={`tk-ios-step${i === activeStep ? " active" : ""}`}>
          <span className="tk-ios-step-num">{i + 1}</span>
          <div className="tk-ios-step-body">
            {s.title}
            <div className="tk-ios-step-hint">{s.hint}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

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
            ? "Suivez les 4 étapes ci-dessous pour ajouter GoCiviq à votre écran d'accueil. Indispensable pour recevoir les notifications de tickets sur iPhone."
            : isDenied
              ? "Vous avez précédemment refusé les notifications. Réactivez-les depuis les réglages de votre navigateur ou de votre téléphone pour ne plus rater une assignation."
              : "Recevez les nouveaux tickets et les assignations en temps réel sur votre téléphone, même quand l'application est fermée. Indispensable pour les agents de terrain."}
        </p>

        {isIos && <IosInstallSteps />}

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

          {isIos ? (
            <div className="tk-push-ios-ctas">
              <button
                type="button"
                onClick={dismissForSession}
                className="tk-push-modal-cta"
                title="Si vous avez installé l'app, fermez Safari et rouvrez depuis l'icône GoCiviq"
              >
                <CheckCircle2 size={16} /> C&apos;est fait
              </button>
              <button
                type="button"
                onClick={dismissForSession}
                className="tk-push-modal-cta tk-push-modal-cta-secondary"
              >
                Pas encore
              </button>
              <a
                href="mailto:contact@gociviq.fr?subject=Besoin%20d%27aide%20%E2%80%94%20installation%20iPhone"
                className="tk-push-modal-cta tk-push-modal-cta-help"
              >
                <Sparkles size={14} /> Trop dur, aidez-moi
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={dismissForSession}
              className="tk-push-modal-skip"
            >
              {isDenied ? "Continuer pour cette session" : "Plus tard"}
            </button>
          )}
        </div>

        {!isIos && (
          <p className="tk-push-modal-footnote">
            <CheckCircle2 size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Vous pourrez modifier ce choix à tout moment dans <strong>Profil → Notifications</strong>.
          </p>
        )}
      </div>

      <style>{`
        .tk-push-ios-ctas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .tk-push-ios-ctas > :first-child {
          grid-column: 1 / -1;
        }
        .tk-push-modal-cta-secondary {
          background: #fff !important;
          color: var(--fg, #1a2744) !important;
          border: 1.5px solid var(--border, #e8e5de) !important;
          box-shadow: none !important;
          font-size: 13px !important;
          padding: 10px 14px !important;
        }
        .tk-push-modal-cta-secondary:hover {
          background: var(--bg-soft, #faf9f6) !important;
          transform: none !important;
        }
        .tk-push-modal-cta-help {
          background: transparent !important;
          color: var(--accent, #ff5a5f) !important;
          border: 1.5px solid var(--accent, #ff5a5f) !important;
          box-shadow: none !important;
          font-size: 13px !important;
          padding: 10px 14px !important;
          text-decoration: none;
        }

        /* ── iOS install steps ── */
        .tk-ios-steps {
          display: grid;
          gap: 10px;
          margin: 0 0 18px;
          text-align: left;
        }
        .tk-ios-step {
          display: grid;
          grid-template-columns: 36px 1fr;
          gap: 12px;
          align-items: flex-start;
          padding: 12px 14px;
          background: var(--bg-soft, #faf9f6);
          border: 1.5px solid transparent;
          border-radius: 12px;
          transition: background 0.4s, border-color 0.4s, transform 0.4s;
        }
        .tk-ios-step.active {
          background: #fff;
          border-color: var(--accent, #ff5a5f);
          box-shadow: 0 6px 18px rgba(255,90,95,0.12);
          transform: translateY(-2px);
        }
        .tk-ios-step-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid var(--border, #e8e5de);
          color: var(--fg-muted, #888);
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.4s, border-color 0.4s, color 0.4s;
        }
        .tk-ios-step.active .tk-ios-step-num {
          background: var(--accent, #ff5a5f);
          border-color: var(--accent, #ff5a5f);
          color: #fff;
        }
        .tk-ios-step-body {
          min-width: 0;
          font-size: 14px;
          color: var(--fg, #1a2744);
          line-height: 1.5;
        }
        .tk-ios-step-body strong { color: var(--fg, #1a2744); }
        .tk-ios-step-hint {
          font-size: 12px;
          color: var(--fg-muted, #888);
          margin-top: 3px;
          line-height: 1.45;
        }
        .tk-ios-step-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          background: #fff;
          border: 1.5px solid var(--border, #e8e5de);
          border-radius: 6px;
          margin: 0 2px;
          vertical-align: -6px;
          color: var(--fg, #1a2744);
        }
        .tk-ios-step.active .tk-ios-step-icon {
          border-color: var(--accent, #ff5a5f);
          color: var(--accent, #ff5a5f);
          animation: tk-ios-pulse 1s ease-out infinite;
        }
        @keyframes tk-ios-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,90,95,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(255,90,95,0); }
        }
        .tk-ios-step-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          margin-left: 4px;
          vertical-align: 1px;
        }

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

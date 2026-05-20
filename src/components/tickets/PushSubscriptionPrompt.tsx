"use client";

import { useEffect, useState } from "react";
import { Bell, X, Smartphone, Share, Plus } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

// ═══════════════════════════════════════════════════════════════
// PushSubscriptionPrompt
//
// Affiche un encart discret en bas à droite invitant l'agent à
// activer les notifications. Caché si déjà souscrit, refusé,
// ou si l'utilisateur l'a fermé manuellement (localStorage).
//
// Cas spécial iOS : si l'app n'est pas installée en PWA, on
// affiche un guide pour l'ajouter à l'écran d'accueil.
// ═══════════════════════════════════════════════════════════════

const DISMISS_KEY = "tickets:push:dismissed";
const DISMISS_DAYS = 14;

export default function PushSubscriptionPrompt() {
  const { status, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      setDismissed(false);
      return;
    }
    try {
      const ts = Number(raw);
      const days = (Date.now() - ts) / 86_400_000;
      setDismissed(days < DISMISS_DAYS);
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  }

  if (dismissed) return null;
  if (status === "loading" || status === "subscribed" || status === "denied" || status === "unsupported") {
    return null;
  }

  // ─── Cas iOS hors PWA ───
  if (status === "ios-pwa-required") {
    return (
      <div className="tk-push-prompt">
        <button type="button" onClick={dismiss} className="tk-push-prompt-close" aria-label="Fermer">
          <X size={14} />
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div className="tk-push-prompt-icon">
            <Smartphone size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 3 }}>
              Activer sur iPhone
            </h3>
            <p style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5, marginBottom: 8 }}>
              Pour recevoir les notifications, ajoutez d&apos;abord GoCiviq à votre écran d&apos;accueil :
            </p>
            <ol style={{ fontSize: 12, color: "var(--fg)", paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
              <li>Tapez <Share size={11} style={{ verticalAlign: "middle" }} /> Partager dans Safari</li>
              <li>Puis <Plus size={11} style={{ verticalAlign: "middle" }} /> « Sur l&apos;écran d&apos;accueil »</li>
              <li>Rouvrez l&apos;app depuis l&apos;icône installée</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ─── Cas standard (Chrome, Firefox, Safari macOS, iOS PWA) ───
  return (
    <div className="tk-push-prompt">
      <button type="button" onClick={dismiss} className="tk-push-prompt-close" aria-label="Fermer">
        <X size={14} />
      </button>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className="tk-push-prompt-icon">
          <Bell size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 3 }}>
            Activer les notifications
          </h3>
          <p style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5, marginBottom: 10 }}>
            Recevez les tickets en temps réel sur votre téléphone, même app fermée.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                const ok = await subscribe();
                setBusy(false);
                if (ok) {
                  // Pas besoin de dismiss : status passe à "subscribed"
                }
              }}
              disabled={busy}
              className="civiq-btn civiq-btn-default civiq-btn-sm"
            >
              <Bell size={12} /> {busy ? "Activation…" : "Activer"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="civiq-btn civiq-btn-ghost civiq-btn-sm"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .tk-push-prompt {
          position: fixed;
          bottom: 16px; right: 16px;
          width: min(340px, calc(100vw - 32px));
          padding: 14px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 12px 30px oklch(0 0 0 / 0.12);
          z-index: 100;
          animation: tk-push-slide 0.3s ease-out;
        }
        @keyframes tk-push-slide {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .tk-push-prompt-close {
          position: absolute; top: 8px; right: 8px;
          width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: none; cursor: pointer;
          color: var(--fg-muted);
          border-radius: 4px;
        }
        .tk-push-prompt-close:hover { background: var(--border-light); color: var(--fg); }
        .tk-push-prompt-icon {
          width: 36px; height: 36px;
          flex-shrink: 0;
          background: var(--accent-light); color: var(--accent);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>
    </div>
  );
}

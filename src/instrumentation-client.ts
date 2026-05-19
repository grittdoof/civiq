/**
 * Sentry — instrumentation côté navigateur (Next.js 15+).
 * Activation : voir docs/SENTRY.md
 *
 * sendDefaultPii est volontairement désactivé (conformité RGPD).
 * Les emails utilisateurs sont également supprimés via beforeSend.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [Sentry.replayIntegration()],

  // 10 % des transactions tracées en prod
  tracesSampleRate: 0.1,

  // Logs Sentry activés
  enableLogs: true,

  // Replay : 0 % en session normale, 100 % sur erreur
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // PII désactivé par défaut (RGPD)
  sendDefaultPii: false,

  // Sécurité supplémentaire : supprimer l'email de l'event avant envoi
  beforeSend(event) {
    if (event.user) delete event.user.email;
    return event;
  },

  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    "AbortError",
    "TypeError: cancelled",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

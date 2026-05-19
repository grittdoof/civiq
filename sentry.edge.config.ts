/**
 * Sentry — instrumentation runtime Edge (Middleware, Edge Routes).
 * Activation : voir docs/SENTRY.md
 *
 * S'active uniquement si NEXT_PUBLIC_SENTRY_DSN est définie.
 * sendDefaultPii est volontairement désactivé (conformité RGPD).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10 % des transactions tracées en prod
  tracesSampleRate: 0.1,

  // Logs Sentry activés
  enableLogs: true,

  // PII désactivé par défaut (RGPD)
  sendDefaultPii: false,

  ignoreErrors: ["AbortError"],
});

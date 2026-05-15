/**
 * Sentry — instrumentation côté navigateur.
 *
 * S'active uniquement si NEXT_PUBLIC_SENTRY_DSN est définie côté
 * Vercel. En dev local, ne fait rien (pas d'effet de bord).
 *
 * Pour activer : voir docs/SENTRY.md
 */

// Initialisation différée pour éviter le bundle si Sentry pas installé
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,           // privacy par défaut
        replaysOnErrorSampleRate: 0.1,
        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "Network request failed",
          "AbortError",
          "TypeError: cancelled",
        ],
        beforeSend(event) {
          if (event.user) delete event.user.email;
          return event;
        },
      });
    })
    .catch(() => {
      // @sentry/nextjs non installé — silent
    });
}

export {};

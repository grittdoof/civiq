/**
 * Sentry — instrumentation Node/Edge runtime.
 * Activation : voir docs/SENTRY.md
 */

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        ignoreErrors: ["AbortError"],
      });
    })
    .catch(() => { /* not installed */ });
}

export {};

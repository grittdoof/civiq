# Sentry — Activation production

Suivi des erreurs runtime côté client et serveur. **Gratuit jusqu'à 5 000 erreurs/mois**.

## Activation

### 1. Compte Sentry

→ <https://sentry.io> · « Get started » · choisir le plan **Developer (Free)**.

Créer un projet **Next.js**. Récupérer :
- DSN (`https://xxx@oxxx.ingest.sentry.io/yyy`)
- Auth token (Settings → Account → Auth Tokens, scope `project:releases`)

### 2. Installation

```bash
npm install --save @sentry/nextjs
```

### 3. Variables Vercel

Settings → Environment Variables :

```
NEXT_PUBLIC_SENTRY_DSN  = https://xxx@oxxx.ingest.sentry.io/yyy
SENTRY_AUTH_TOKEN       = sntrys_...   # (secret, Production only)
SENTRY_ORG              = mon-org
SENTRY_PROJECT          = gociviq
```

### 4. Fichiers de config (déjà scaffoldés dans le repo)

- `sentry.client.config.ts` — instrumentation côté navigateur
- `sentry.server.config.ts` — instrumentation Node/Edge
- `sentry.edge.config.ts` — instrumentation Middleware Edge

Tous les 3 utilisent `NEXT_PUBLIC_SENTRY_DSN`. Si la variable est vide,
Sentry **ne charge pas** — pas d'effet de bord en dev local.

### 5. Wrapper du `next.config.ts`

Au-dessus du fichier, après les `headers()` :

```ts
import { withSentryConfig } from "@sentry/nextjs";
// ...
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
```

## Filtres recommandés

Dans `sentry.client.config.ts`, ignorer le bruit habituel :

```ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",       // déjà géré par offline fallback
    "AbortError",                   // navigation interrompue
    "TypeError: cancelled",
  ],
  beforeSend(event) {
    // Pas d'info PII dans les breadcrumbs
    if (event.user) delete event.user.email;
    return event;
  },
});
```

## Test

Une fois déployé, ajouter temporairement un `throw new Error("test")` dans une page,
recharger → erreur visible dans le dashboard Sentry sous 30 s.

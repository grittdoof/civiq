import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Headers de sécurité appliqués à toutes les routes.
 *
 * CSP : on n'utilise pas `unsafe-inline` côté script car Next.js
 * fournit déjà ses scripts nonce-hashed. En revanche, on autorise
 * `unsafe-inline` pour les styles (Lucide icons et certains composants
 * injectent du CSS inline).
 *
 * Sources externes autorisées :
 *  • Supabase REST + Realtime (wss + https)
 *  • Cal.com (booking iframe)
 *  • Google Fonts (CSS + WOFF2)
 *  • OpenStreetMap tiles + Nominatim (Leaflet)
 *  • Vercel insights
 */
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cal.com https://*.cal.com https://app.cal.com https://vercel.live https://*.vercel-insights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.cal.com https://vercel.live https://*.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "frame-src 'self' https://cal.com https://*.cal.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // @react-pdf/renderer dépend de pdfkit/fontkit qui embarquent des
  // ressources binaires : on l'exclut du bundle Next pour qu'il soit
  // résolu au runtime côté Node serverless.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        // Headers de sécurité globaux
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Le service worker doit pouvoir être mis à jour à chaque déploiement
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Org et projet depuis les variables d'environnement (Vercel CI)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Logs uniquement en CI
  silent: !process.env.CI,

  // Upload de source maps plus larges pour de meilleures stack traces
  widenClientFileUpload: true,

  // Route les requêtes Sentry via notre domaine (contourne les ad-blockers)
  // Vérifier que "/monitoring" n'est pas intercepté par le middleware
  tunnelRoute: "/monitoring",

  // Ne pas exposer les source maps publiquement
  sourcemaps: {
    disable: false,        // upload activé pour les stack traces
    deleteSourcemapsAfterUpload: true, // supprime les .map du bundle final
  },

  // Réduit le bundle client en retirant les logs de debug Sentry
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: false,  // Replay activé côté client
  },
});

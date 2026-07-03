import type { Metadata, Viewport } from "next";
import "./globals.css";
import BootLoaderCleanup from "@/components/BootLoaderCleanup";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://www.gociviq.fr",
  ),
  title: {
    default: "GoCiviq — Plateforme citoyenne pour les collectivités",
    template: "%s · GoCiviq",
  },
  description:
    "Plateforme modulaire pour les collectivités engagées dans une démarche de participation citoyenne. Sondages, tickets d'intervention, budget participatif — des outils utiles pour les agents territoriaux et les conseils municipaux.",
  applicationName: "GoCiviq",
  keywords: [
    "consultation citoyenne", "commune", "mairie", "participation citoyenne",
    "sondage", "budget participatif", "intervention", "élu", "France",
  ],
  authors: [{ name: "GoCiviq" }],
  creator: "GoCiviq",
  icons: {
    icon: [
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      // PNG fallback pour Safari iOS et les bots qui n'aiment pas le SVG
      { url: "/app-icon/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/app-icon/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    // iOS exige PNG 180×180 — généré par `npm run generate:icons`
    apple: [{ url: "/app-icon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/favicon/favicon.svg"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GoCiviq",
    statusBarStyle: "default",
    startupImage: ["/app-icon/apple-touch-icon.png"],
  },
  openGraph: {
    title: "GoCiviq — Plateforme citoyenne pour les collectivités",
    description:
      "Modulaire, accessible, créée par un maire. Donnez la parole à vos administrés et pilotez vos interventions terrain.",
    type: "website",
    locale: "fr_FR",
    siteName: "GoCiviq",
  },
  twitter: {
    card: "summary_large_image",
    title: "GoCiviq",
    description: "Plateforme citoyenne pour les collectivités engagées.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#042F64" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          Boot loader SSR-rendu — visible IMMÉDIATEMENT à l'ouverture
          (styles inline, pas de dépendance JS/CSS bundle). Il masque
          l'écran blanc/noir des 3-5 s avant l'hydratation Next.js,
          notamment sur le lancement PWA iOS où start_url requiert
          une redirection d'auth.

          Auto-hide via `DOMContentLoaded` OU après 4 s max en dernier
          recours. Une fois React hydraté, le loader disparaît en
          fondu — les .tsx `loading.tsx` prennent le relais pour les
          navigations intra-app.
        */}
        <div id="civiq-boot" aria-hidden="true">
          <div className="civiq-boot-spinner" />
          <span className="civiq-boot-label">GoCiviq</span>
        </div>
        <style>{`
          #civiq-boot {
            position: fixed; inset: 0;
            z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 14px;
            background: #FFFFFF;
            transition: opacity 0.28s ease-out;
          }
          #civiq-boot.civiq-boot-hidden {
            opacity: 0;
            pointer-events: none;
          }
          .civiq-boot-spinner {
            width: 34px; height: 34px;
            border: 3px solid rgba(4, 47, 100, 0.15);
            border-top-color: #042F64;
            border-radius: 50%;
            animation: civiq-boot-spin 0.9s linear infinite;
          }
          .civiq-boot-label {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px; font-weight: 600; letter-spacing: 0.02em;
            color: #042F64;
            opacity: 0.75;
          }
          @keyframes civiq-boot-spin { to { transform: rotate(360deg); } }
          @media (prefers-color-scheme: dark) {
            #civiq-boot { background: #042F64; }
            .civiq-boot-spinner { border-color: rgba(255,255,255,0.15); border-top-color: #fff; }
            .civiq-boot-label { color: #fff; }
          }
        `}</style>
        <BootLoaderCleanup />
        {children}
      </body>
    </html>
  );
}

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
        {/*
          Styles du boot loader placés dans <head> pour qu'ils soient
          parsés AVANT que le body ne soit rendu — sinon layout.css
          externe (qui bloque le paint) monopolise le rendu et le
          loader n'est visible que quelques ms.
          Le fond html/body est aussi défini ici pour que la fenêtre
          soit colorée dès l'arrivée du HTML (jamais blanc/noir).
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { background: #FFFFFF; margin: 0; }
          #civiq-boot {
            position: fixed; inset: 0;
            z-index: 2147483647;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 14px;
            background: #FFFFFF;
            transition: opacity 0.28s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          .civiq-boot-logo {
            width: 84px; height: auto; display: block;
          }
          @keyframes civiq-boot-spin { to { transform: rotate(360deg); } }
        ` }} />
        {/* Préchargement du logo utilisé par le boot loader */}
        <link rel="preload" as="image" href="/brand/logo-vertical.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/*
          Boot loader SSR-rendu — visible IMMÉDIATEMENT à l'ouverture.
          Styles dans <head> (voir plus haut), donc pas de dépendance
          au layout.css externe qui bloque le paint sur mobile lent.
          Masque le blank 3-5 s avant l'hydratation Next.js (surtout
          PWA iOS avec redirection d'auth).
          BootLoaderCleanup (client) ajoute la classe civiq-boot-hidden
          au montage — le noeud reste dans le DOM (React en garde la
          propriété, sinon insertBefore lève NotFoundError sur iOS).
        */}
        <div id="civiq-boot" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="civiq-boot-logo" src="/brand/logo-vertical.svg" alt="" />
          <div className="civiq-boot-spinner" />
        </div>
        <BootLoaderCleanup />
        {children}
      </body>
    </html>
  );
}

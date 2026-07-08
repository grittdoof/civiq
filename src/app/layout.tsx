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
  // L'app n'a pas d'UI sombre fonctionnelle (le contenu réel reste
  // toujours clair, cf. globals.css [data-theme="dark"] non utilisé).
  // Une themeColor sombre ici teinterait la barre de statut iOS en
  // marine en permanence, alors que apple-mobile-web-app-status-bar-style
  // "default" garde des icônes noires → texte noir illisible sur fond
  // marine sur tout l'app, pas seulement au démarrage.
  themeColor: "#FFFFFF",
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
          Le fond marine du mode sombre est réservé à #civiq-boot (qui
          couvre tout le viewport pendant le chargement) : html/body
          reste clair en permanence, sinon le bounce iOS (overscroll
          élastique) révèle un bandeau marine derrière une barre de
          statut aux icônes noires (illisible) sur TOUTES les pages,
          pas seulement au démarrage — l'app n'a pas d'UI sombre réelle.
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
          .civiq-boot-label {
            font-size: 14px; font-weight: 600; letter-spacing: 0.02em;
            color: #042F64; opacity: 0.75;
          }
          @keyframes civiq-boot-spin { to { transform: rotate(360deg); } }
          @media (prefers-color-scheme: dark) {
            #civiq-boot { background: #042F64; }
            .civiq-boot-spinner { border-color: rgba(255,255,255,0.15); border-top-color: #fff; }
            .civiq-boot-label { color: #fff; }
          }
        ` }} />
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
          <div className="civiq-boot-spinner" />
          <span className="civiq-boot-label">GoCiviq</span>
        </div>
        <BootLoaderCleanup />
        {children}
      </body>
    </html>
  );
}

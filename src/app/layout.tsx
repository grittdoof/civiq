import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.gociviq.fr"),
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
    ],
    apple: [{ url: "/app-icon/icon-ios.svg" }],
    shortcut: ["/favicon/favicon.svg"],
  },
  manifest: "/manifest.webmanifest",
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
      <body>{children}</body>
    </html>
  );
}

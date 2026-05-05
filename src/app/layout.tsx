import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoCiviQ — Plateforme de sondages civiques",
  description:
    "Plateforme modulaire de sondages et consultations pour les collectivités locales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Stack typo Airbnb-like :
            • Fraunces (serif) — titres / display
            • DM Sans         — UI / body
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

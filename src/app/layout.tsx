import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CiviQ — Plateforme de sondages civiques",
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
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

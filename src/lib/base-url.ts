// ═══════════════════════════════════════════════════════════════
// getBaseUrl — URL absolue de la plateforme
//
// Utilisée par tous les endpoints qui envoient des liens absolus
// dans des emails, notifications push, invitations, PDFs, etc.
//
// Priorité :
//   1. NEXT_PUBLIC_SITE_URL       — override explicite (dev local ou
//                                    domaine alternatif). Prime sur tout.
//   2. VERCEL_ENV === 'production' → https://www.gociviq.fr
//      (garantit qu'un déploiement de prod pointe TOUJOURS sur le
//       domaine canonique, jamais sur l'URL de déploiement Vercel
//       type civiq-abc123.vercel.app qui expose le nom du projet et
//       change à chaque redeploy).
//   3. VERCEL_URL                  — URL du preview/branch deploy
//                                    (utile pour tester une PR).
//   4. Fallback ultime             — https://www.gociviq.fr
//
// Anti-régression du bug rapporté : sur un déploiement Vercel de
// prod sans NEXT_PUBLIC_SITE_URL configurée, l'ancien code retombait
// sur VERCEL_URL car il était évalué avant le fallback. Les mails
// contenaient alors des liens vercel.app cassants et non brandés.
// ═══════════════════════════════════════════════════════════════

export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === "production") {
    return "https://www.gociviq.fr";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://www.gociviq.fr";
}

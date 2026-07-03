// ═══════════════════════════════════════════════════════════════
// getBaseUrl — URL absolue de la plateforme
//
// Utilisée par tous les endpoints qui envoient des liens absolus
// dans des emails, notifications push, invitations, PDFs, etc.
//
// Priorité :
//   1. NEXT_PUBLIC_SITE_URL ou NEXT_PUBLIC_APP_URL — override
//      explicite (dev local ou domaine alternatif). Les deux noms
//      sont acceptés pour compatibilité historique : .env.local
//      utilise APP_URL, .env.example documente SITE_URL. Le premier
//      défini gagne.
//   2. VERCEL_ENV === 'production' → https://www.gociviq.fr
//      (garantit qu'un déploiement de prod pointe TOUJOURS sur le
//       domaine canonique, jamais sur l'URL de déploiement Vercel
//       type civiq-abc123.vercel.app qui expose le nom du projet et
//       change à chaque redeploy).
//   3. VERCEL_URL                  — URL du preview/branch deploy
//                                    (utile pour tester une PR).
//   4. Fallback ultime             — https://www.gociviq.fr
//
// Le trailing slash éventuel est stripé pour que la concaténation
// avec un path (ex : `${base}/admin/…`) ne produise pas de double /.
//
// Anti-régression du bug rapporté : sur un déploiement Vercel de
// prod avec NEXT_PUBLIC_APP_URL (au lieu de SITE_URL) configurée,
// l'ancien code ignorait la var et retombait sur VERCEL_URL. Les
// mails contenaient alors des liens vercel.app cassants.
// ═══════════════════════════════════════════════════════════════

export function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return stripTrailingSlash(explicit);
  if (process.env.VERCEL_ENV === "production") {
    return "https://www.gociviq.fr";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://www.gociviq.fr";
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

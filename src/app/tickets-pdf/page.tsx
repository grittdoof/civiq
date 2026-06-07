import { Suspense } from "react";
import PdfLoader from "./PdfLoader";

// ═══════════════════════════════════════════════════════════════
// /tickets-pdf — page intermédiaire de chargement, PLEINE PAGE.
//
// Volontairement HORS de /admin/ : on contourne ainsi l'AdminShell
// (sidebar, header, modale PushSubscriptionPrompt) pour un rendu
// vraiment plein écran. L'API /api/tickets/pdf vérifie l'auth, donc
// pas de problème de sécurité même si la route est accessible sans
// passer par le guard /admin du middleware.
// Ouverte dans un nouvel onglet par le bouton "Imprimer / PDF".
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default function PdfLoadingPage() {
  return (
    <Suspense>
      <PdfLoader />
    </Suspense>
  );
}

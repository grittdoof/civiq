import { Suspense } from "react";
import PdfLoader from "./PdfLoader";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/pdf — page intermédiaire de chargement.
//
// Ouverte par le bouton "Imprimer / PDF" dans un nouvel onglet.
// Affiche un spinner pendant que /api/tickets/pdf génère le binaire,
// puis remplace l'onglet par le PDF (via Blob URL).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default function PdfLoadingPage() {
  return (
    <Suspense>
      <PdfLoader />
    </Suspense>
  );
}

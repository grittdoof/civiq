import { Suspense } from "react";
import PdfLoader from "./PdfLoader";
import PdfChooser from "./PdfChooser";

// ═══════════════════════════════════════════════════════════════
// /tickets-pdf
//
// Sans ?go=1 → écran de choix (filtre statut + multi-select agents)
// Avec ?go=1 → loader qui appelle /api/tickets/pdf et ouvre le PDF
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ go?: string }>;
}

export default async function PdfLoadingPage({ searchParams }: PageProps) {
  const { go } = await searchParams;
  return (
    <Suspense>
      {go === "1" ? <PdfLoader /> : <PdfChooser />}
    </Suspense>
  );
}

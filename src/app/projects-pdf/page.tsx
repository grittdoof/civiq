import { Suspense } from "react";
import PdfLoader from "./PdfLoader";

// Page intermédiaire de chargement pleine page (hors /admin).
// Reçoit ?kind=project|attendance|minutes &id|cid|sid=...

export const dynamic = "force-dynamic";

export default function ProjectsPdfPage() {
  return (
    <Suspense>
      <PdfLoader />
    </Suspense>
  );
}

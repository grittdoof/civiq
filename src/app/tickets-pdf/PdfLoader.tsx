"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, AlertTriangle, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PdfLoader — client component qui :
//   1. Affiche un spinner + message progressif (fetch / mise en page)
//   2. Fetch /api/tickets/pdf?filter=... → Blob
//   3. Crée une URL d'objet et remplace l'onglet par le PDF
//
// La gestion d'erreur affiche un message + retour vers /admin/tickets.
// ═══════════════════════════════════════════════════════════════

type Phase = "preparing" | "fetching" | "rendering" | "error";

export default function PdfLoader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "tous";

  const [phase, setPhase] = useState<Phase>("preparing");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  // Compteur en secondes pour rassurer l'utilisateur sur les gros volumes
  useEffect(() => {
    if (phase === "error") return;
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        setPhase("fetching");
        const url = `/api/tickets/pdf${filter !== "tous" ? `?filter=${filter}` : ""}`;
        const res = await fetch(url, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Erreur ${res.status}`);
        }
        setPhase("rendering");
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        // Remplace l'onglet courant par le PDF (le navigateur l'affiche
        // nativement avec ses contrôles de download et d'impression).
        window.location.replace(blobUrl);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  // Libère le blob URL si l'utilisateur ferme l'onglet
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const filterLabel =
    filter === "ouverts" ? "tickets ouverts" :
    filter === "cloture" ? "tickets clôturés" :
    "tous les tickets";

  return (
    <main className="tk-pdf-loader">
      <div className="tk-pdf-loader-card">
        {phase === "error" ? (
          <>
            <div className="tk-pdf-loader-icon tk-pdf-loader-icon--error">
              <AlertTriangle size={28} />
            </div>
            <h1 className="tk-pdf-loader-title">Génération impossible</h1>
            <p className="tk-pdf-loader-message">
              {error ?? "Une erreur est survenue."}
            </p>
            <div className="tk-pdf-loader-actions">
              <button
                type="button"
                onClick={() => router.replace("/admin/tickets")}
                className="civiq-btn civiq-btn-outline"
              >
                <ArrowLeft size={14} /> Retour aux tickets
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="civiq-btn civiq-btn-default"
              >
                Réessayer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tk-pdf-loader-icon tk-pdf-loader-icon--spin">
              <FileText size={26} strokeWidth={1.7} />
              <span className="tk-pdf-loader-ring" aria-hidden />
            </div>
            <h1 className="tk-pdf-loader-title">Préparation du PDF</h1>
            <p className="tk-pdf-loader-message">
              Compilation de {filterLabel}…
            </p>
            <div className="tk-pdf-loader-progress" aria-hidden>
              <span className="tk-pdf-loader-progress-bar" />
            </div>
            <p className="tk-pdf-loader-step">
              {phase === "preparing" && "Connexion…"}
              {phase === "fetching" && `Génération du document${elapsed > 0 ? ` · ${elapsed}s` : ""}`}
              {phase === "rendering" && "Ouverture du PDF…"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

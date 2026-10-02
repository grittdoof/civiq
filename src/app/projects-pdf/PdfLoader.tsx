"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, AlertTriangle, ArrowLeft } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PdfLoader (projets / commissions) — adapté du module tickets.
// Lit ?kind=project|fiche|reporting|attendance|minutes et ?id=... pour
// cibler la bonne route API. Chaque ouverture régénère le document
// (no-store + paramètre horodaté) : il reflète toujours l'état courant.
// Word (format=docx) : téléchargé à la fin, puis message de confirmation.
// ═══════════════════════════════════════════════════════════════

type Phase = "preparing" | "fetching" | "rendering" | "done" | "error";

export default function PdfLoader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind") ?? "project";
  const id = searchParams.get("id") ?? "";
  const cid = searchParams.get("cid") ?? ""; // commission id pour les PDFs de séance
  const sid = searchParams.get("sid") ?? ""; // session id
  const format = searchParams.get("format") === "docx" ? "docx" : "pdf";
  const variante = searchParams.get("variante") === "communicable" ? "communicable" : "complete";

  const [phase, setPhase] = useState<Phase>("preparing");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase === "error") return;
    const start = Date.now();
    const t = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        setPhase("fetching");
        let url = "";
        if (kind === "project" || kind === "fiche") url = `/api/projects/${id}/fiche?format=${format}&variante=${variante}`;
        else if (kind === "reporting") {
          const q = new URLSearchParams({ format });
          for (const k of ["commission", "type", "statut"]) { const v = searchParams.get(k); if (v) q.set(k, v); }
          url = `/api/projects/reporting?${q}`;
        }
        else if (kind === "attendance") url = `/api/commissions/${cid}/sessions/${sid}/attendance-pdf`;
        else if (kind === "minutes") url = `/api/commissions/${cid}/sessions/${sid}/minutes-pdf`;
        else throw new Error("Type de document inconnu");

        url += `${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
        const res = await fetch(url, { credentials: "include", cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let message = text;
          try { message = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* texte brut */ }
          throw new Error(res.status === 404 ? "Ce projet est introuvable ou vous n'y avez pas accès." : message || `Erreur ${res.status}`);
        }
        setPhase("rendering");
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        if (format === "docx") {
          // Word : téléchargement (nom fourni par le serveur), la page reste ouverte.
          const nom = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "document.docx";
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = nom;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setPhase("done");
          return;
        }
        window.location.replace(blobUrl);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    })();

    return () => { cancelled = true; };
  }, [kind, id, cid, sid, format, variante, searchParams]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const docLabel =
    kind === "project" || kind === "fiche" ? "fiche projet" :
    kind === "reporting" ? "synthèse de reporting" :
    kind === "attendance" ? "feuille d'émargement" :
    kind === "minutes" ? "compte rendu de séance" :
    "document";

  return (
    <main className="tk-pdf-loader">
      <div className="tk-pdf-loader-card">
        {phase === "done" ? (
          <>
            <div className="tk-pdf-loader-icon">
              <FileText size={26} strokeWidth={1.7} />
            </div>
            <h1 className="tk-pdf-loader-title">Document Word prêt</h1>
            <p className="tk-pdf-loader-message">Le téléchargement de la {docLabel} a démarré. Vous pouvez fermer cet onglet.</p>
            <div className="tk-pdf-loader-actions">
              <button type="button" onClick={() => window.close()} className="civiq-btn civiq-btn-outline">Fermer l&apos;onglet</button>
            </div>
          </>
        ) : phase === "error" ? (
          <>
            <div className="tk-pdf-loader-icon tk-pdf-loader-icon--error">
              <AlertTriangle size={28} />
            </div>
            <h1 className="tk-pdf-loader-title">Génération impossible</h1>
            <p className="tk-pdf-loader-message">{error ?? "Une erreur est survenue."}</p>
            <div className="tk-pdf-loader-actions">
              <button
                type="button"
                onClick={() => router.back()}
                className="civiq-btn civiq-btn-outline"
              >
                <ArrowLeft size={14} /> Retour
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
            <h1 className="tk-pdf-loader-title">{format === "docx" ? "Préparation du document Word" : "Préparation du PDF"}</h1>
            <p className="tk-pdf-loader-message">Compilation de la {docLabel}…</p>
            <div className="tk-pdf-loader-progress" aria-hidden>
              <span className="tk-pdf-loader-progress-bar" />
            </div>
            <p className="tk-pdf-loader-step">
              {phase === "preparing" && "Connexion…"}
              {phase === "fetching" && `Génération du document${elapsed > 0 ? ` · ${elapsed}s` : ""}`}
              {phase === "rendering" && (format === "docx" ? "Téléchargement…" : "Ouverture du PDF…")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

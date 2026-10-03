"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, AlertTriangle, ArrowLeft, Download, ExternalLink } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PdfLoader (projets / commissions) — adapté du module tickets.
// Lit ?kind=project|fiche|reporting|attendance|minutes et ?id=... pour
// cibler la bonne route API. Chaque ouverture régénère le document
// (no-store + paramètre horodaté) : il reflète toujours l'état courant.
// Le fichier est téléchargé sous son vrai nom (Content-Disposition) et
// la page reste ouverte : un lien blob: appartient à la page qui l'a créé,
// la quitter (ancien `location.replace(blob)`) le détruisait — Chrome
// échouait alors le téléchargement (« Vérifiez votre connexion Internet »,
// fichier nommé par un UUID).
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
  const [fichier, setFichier] = useState<{ url: string; nom: string } | null>(null);

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
        const nom = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1]
          ?? (format === "docx" ? "document.docx" : "document.pdf");
        setFichier({ url: blobUrl, nom });
        telecharger(blobUrl, nom);
        setPhase("done");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    })();

    return () => { cancelled = true; };
  }, [kind, id, cid, sid, format, variante, searchParams]);

  // Pas de révocation du lien blob : le navigateur le libère à la fermeture
  // de l'onglet, et le révoquer plus tôt casse « Ouvrir » / « Télécharger ».

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
            <h1 className="tk-pdf-loader-title">{format === "docx" ? "Document Word prêt" : "PDF prêt"}</h1>
            <p className="tk-pdf-loader-message">
              Le téléchargement de la {docLabel} a démarré{fichier ? <> (<strong>{fichier.nom}</strong>)</> : null}.
            </p>
            <div className="tk-pdf-loader-actions">
              {fichier && format === "pdf" && (
                <a href={fichier.url} target="_blank" rel="noopener" className="civiq-btn civiq-btn-default">
                  <ExternalLink size={14} aria-hidden="true" /> Ouvrir le PDF
                </a>
              )}
              {fichier && (
                <button type="button" onClick={() => telecharger(fichier.url, fichier.nom)} className="civiq-btn civiq-btn-outline">
                  <Download size={14} aria-hidden="true" /> Télécharger à nouveau
                </button>
              )}
              <button type="button" onClick={() => window.close()} className="civiq-btn civiq-btn-ghost">Fermer l&apos;onglet</button>
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
              {phase === "rendering" && "Téléchargement…"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function telecharger(url: string, nom: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

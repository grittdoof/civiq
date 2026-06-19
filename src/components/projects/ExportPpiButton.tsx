"use client";

import { useEffect, useState } from "react";
import { FileDown, Database, Layers, Sparkles, CheckCircle2 } from "lucide-react";

interface Props {
  communeName: string;
}

// Étapes du loader pour storytelling pendant le chargement.
// Chaque étape s'affiche tour à tour avec son icône.
const LOADER_STEPS = [
  { icon: Database, label: "Agrégation des données" },
  { icon: Layers, label: "Construction du PPI multi-année" },
  { icon: Sparkles, label: "Mise en page du document" },
  { icon: CheckCircle2, label: "Finalisation" },
];

// Délai par étape (ms) — la dernière reste affichée jusqu'à la réception
// du PDF côté serveur, qui termine en moyenne en 1.2-2.5s.
const STEP_DELAY = 700;

export default function ExportPpiButton({ communeName }: Props) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Avance automatiquement à travers les étapes de storytelling
  // pendant que le PDF se génère.
  useEffect(() => {
    if (!busy) return;
    if (step >= LOADER_STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, LOADER_STEPS.length - 1)), STEP_DELAY);
    return () => clearTimeout(t);
  }, [busy, step]);

  async function exportPdf() {
    setBusy(true);
    setStep(0);
    setError(null);
    try {
      const res = await fetch("/api/projects/ppi/pdf", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const slug = communeName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      a.download = `ppi-${slug}-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Petite pause pour laisser l'animation se finir avant de fermer
      setTimeout(() => {
        URL.revokeObjectURL(url);
        setBusy(false);
        setStep(0);
      }, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="civiq-btn civiq-btn-default"
        onClick={exportPdf}
        disabled={busy}
      >
        <FileDown size={14} /> Exporter le PPI en PDF
      </button>

      {busy && (
        <div
          className="pj-pdf-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Génération du PDF"
        >
          <div className="pj-pdf-modal">
            <div className="pj-pdf-spinner" aria-hidden>
              <svg viewBox="0 0 60 60" width="64" height="64">
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke="var(--civiq-border, #e8e5de)"
                  strokeWidth="4"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke="var(--civiq-primary, #1a2744)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="163"
                  strokeDashoffset="40"
                  transform="rotate(-90 30 30)"
                  className="pj-pdf-spinner-arc"
                />
              </svg>
            </div>

            <ul className="pj-pdf-steps">
              {LOADER_STEPS.map(({ icon: Icon, label }, i) => {
                const state =
                  i < step ? "done" : i === step ? "current" : "pending";
                return (
                  <li key={label} className={`pj-pdf-step is-${state}`}>
                    <span className="pj-pdf-step-icon" aria-hidden>
                      <Icon size={14} />
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>

            <p className="pj-pdf-hint">
              Vous pouvez fermer cette fenêtre une fois le téléchargement lancé.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="pj-pdf-error-toast" role="alert">
          <strong>Erreur d&apos;export :</strong> {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="pj-pdf-error-close"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Download, Check, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// QR Share — Modal pour télécharger / copier le QR d'un sondage
// Utilisable depuis le dashboard ou la page résultats.
// ═══════════════════════════════════════════════════════════════

interface QrShareProps {
  url: string;
  title: string;
  trigger?: "icon" | "button";
}

export default function QrShare({ url, title, trigger = "icon" }: QrShareProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: "#1a2744", light: "#ffffff" },
      errorCorrectionLevel: "H",
    }).then(setDataUrl).catch(console.error);
  }, [open, url]);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    a.click();
  }

  return (
    <>
      {trigger === "icon" ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          className="civiq-icon-btn"
          title="Partager le QR code"
        >
          <QrCode size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="civiq-btn civiq-btn-outline"
        >
          <QrCode size={14} /> Partager le QR
        </button>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16, backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="civiq-card"
            style={{ maxWidth: 420, width: "100%", padding: 24 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Partager le sondage</h3>
                <p style={{ fontSize: 12, color: "var(--fg-muted)" }}>{title}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="civiq-icon-btn" title="Fermer">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, padding: 16, background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
              {dataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={dataUrl} alt={`QR ${title}`} style={{ width: 240, height: 240, display: "block" }} />
              ) : (
                <div style={{ width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)" }}>
                  Génération…
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            <div style={{
              fontSize: 12, color: "var(--fg-muted)", padding: "8px 12px",
              background: "var(--bg)", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", wordBreak: "break-all", marginBottom: 12,
              fontFamily: "ui-monospace, monospace",
            }}>
              {url}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={copyUrl} className="civiq-btn civiq-btn-outline" style={{ flex: 1 }}>
                {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le lien</>}
              </button>
              <button type="button" onClick={downloadPng} className="civiq-btn civiq-btn-default" style={{ flex: 1 }}>
                <Download size={14} /> Télécharger PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

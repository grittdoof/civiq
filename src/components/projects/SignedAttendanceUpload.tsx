"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ExternalLink, Trash2, Loader2, FileSignature } from "lucide-react";

interface Props {
  commissionId: string;
  sessionId: string;
  initialUrl: string | null;
  initialUploadedAt: string | null;
  canEdit: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SignedAttendanceUpload — Permet de joindre un PDF scanné de la
// feuille d'émargement signée à la main pendant la séance.
// Stocke storage_path + URL signée sur commission_sessions.
// ═══════════════════════════════════════════════════════════════

export default function SignedAttendanceUpload({
  commissionId, sessionId, initialUrl, initialUploadedAt, canEdit,
}: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [uploadedAt, setUploadedAt] = useState(initialUploadedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = `/api/commissions/${commissionId}/sessions/${sessionId}/signed-pdf`;

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(apiUrl, { method: "POST", body: form });
      const data = (await res.json()) as { signed_url?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Erreur");
      } else if (data.signed_url) {
        setUrl(data.signed_url);
        setUploadedAt(new Date().toISOString());
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function remove() {
    if (!confirm("Supprimer la feuille d'émargement signée jointe ?")) return;
    setBusy(true);
    const res = await fetch(apiUrl, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setUrl(null);
      setUploadedAt(null);
      router.refresh();
    }
  }

  return (
    <div className="pj-signed-attendance">
      {url ? (
        <div className="pj-signed-attendance-have">
          <FileSignature size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={url} target="_blank" rel="noreferrer" className="pj-table-strong" style={{ color: "var(--civiq-primary)", textDecoration: "none" }}>
              Émargement signé (PDF) <ExternalLink size={11} />
            </a>
            {uploadedAt && (
              <div className="pj-table-sub">
                Joint le {new Date(uploadedAt).toLocaleString("fr-FR")}
              </div>
            )}
          </div>
          {canEdit && (
            <>
              <label className="civiq-btn civiq-btn-outline civiq-btn-sm" style={{ cursor: busy ? "wait" : "pointer" }}>
                {busy ? <Loader2 className="spin" size={12} /> : <Upload size={12} />}
                Remplacer
                <input type="file" accept="application/pdf" onChange={upload} disabled={busy} style={{ display: "none" }} />
              </label>
              <button type="button" onClick={remove} disabled={busy} className="civiq-icon-btn danger" aria-label="Supprimer">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ) : (
        canEdit ? (
          <label className="pj-signed-attendance-placeholder">
            {busy ? <Loader2 className="spin" size={18} /> : <FileSignature size={18} />}
            <div>
              <strong>Joindre un émargement signé (PDF)</strong>
              <div className="pj-table-sub">
                Pratique quand vous faites signer les conseillers sur papier
                pendant la séance puis scannez la feuille.
              </div>
            </div>
            <input type="file" accept="application/pdf" onChange={upload} disabled={busy} style={{ display: "none" }} />
          </label>
        ) : null
      )}
      {error && <div className="pj-modal-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

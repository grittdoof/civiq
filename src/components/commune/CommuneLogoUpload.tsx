"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

interface Props {
  communeId: string;
  communeName: string;
  initialUrl: string | null;
  /** Désactive l'édition (ex. éditeur sans droits admin) */
  readOnly?: boolean;
  onChange?: (url: string | null) => void;
}

// ═══════════════════════════════════════════════════════════════
// Logo de la commune — aperçu + remplacement + suppression.
// Utilisé dans « Profil & paramètres » (admin) et la fiche commune
// du super-admin. Le logo figure en tête des emails de convocation,
// des sondages publics et des PDF.
// ═══════════════════════════════════════════════════════════════
export default function CommuneLogoUpload({ communeId, communeName, initialUrl, readOnly, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(next: string | null) {
    setUrl(next);
    onChange?.(next);
  }

  async function upload(file: File) {
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Format non supporté : PNG, JPG ou WebP (le SVG ne s'affiche pas dans Gmail).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image trop volumineuse (2 Mo maximum).");
      return;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/communes/${communeId}/logo`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { logo_url?: string; error?: string };
      if (!res.ok || !data.logo_url) throw new Error(data.error ?? `Erreur ${res.status}`);
      update(data.logo_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Retirer le logo de la commune ?")) return;
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch(`/api/communes/${communeId}/logo`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      update(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="commune-logo-upload">
      <div className="commune-logo-preview" aria-live="polite">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Logo de ${communeName}`} />
        ) : (
          <span className="commune-logo-empty"><ImageIcon size={22} aria-hidden /> Aucun logo</span>
        )}
      </div>
      <div className="commune-logo-side">
        <p className="commune-logo-hint">
          PNG, JPG ou WebP, 2 Mo max. Idéalement sur fond transparent ou blanc,
          au moins 300 px de large. Affiché en tête des emails de convocation,
          des sondages et des PDF.
        </p>
        {!readOnly && (
          <div className="commune-logo-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
            />
            <button
              type="button"
              className="civiq-btn civiq-btn-outline civiq-btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
            >
              {busy === "upload" ? <Loader2 size={14} className="commune-logo-spin" /> : <Upload size={14} />}
              {url ? "Remplacer le logo" : "Ajouter un logo"}
            </button>
            {url && (
              <button
                type="button"
                className="civiq-btn civiq-btn-ghost civiq-btn-sm"
                onClick={remove}
                disabled={busy !== null}
              >
                {busy === "delete" ? <Loader2 size={14} className="commune-logo-spin" /> : <Trash2 size={14} />}
                Retirer
              </button>
            )}
          </div>
        )}
        {error && <p className="commune-logo-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

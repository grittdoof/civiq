"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Trash2, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  current: string | null;
  canEdit: boolean;
}

export default function ProjectPhotoUpload({ projectId, current, canEdit }: Props) {
  const router = useRouter();
  const [photo, setPhoto] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/projects/${projectId}/photo`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { photo_url?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Erreur");
      } else if (data.photo_url) {
        setPhoto(data.photo_url);
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
    if (!confirm("Supprimer la photo de couverture ?")) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${projectId}/photo`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setPhoto(null);
      router.refresh();
    }
  }

  return (
    <div className="pj-photo">
      {photo ? (
        <div className="pj-photo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Photo du projet" className="pj-photo-img" />
          {canEdit && (
            <div className="pj-photo-actions">
              <label className="civiq-btn civiq-btn-outline civiq-btn-sm" style={{ cursor: "pointer" }}>
                {busy ? <Loader2 className="spin" size={14} /> : <Upload size={14} />}
                Remplacer
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} style={{ display: "none" }} />
              </label>
              <button type="button" onClick={remove} disabled={busy} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                <Trash2 size={14} /> Retirer
              </button>
            </div>
          )}
        </div>
      ) : (
        canEdit && (
          <label className="pj-photo-placeholder">
            {busy ? <Loader2 className="spin" size={20} /> : <Camera size={20} />}
            <span>{busy ? "Envoi…" : "Ajouter une photo"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>
        )
      )}
      {error && <div className="pj-modal-error" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}

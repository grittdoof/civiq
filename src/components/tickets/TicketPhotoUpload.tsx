"use client";

import { useState, useCallback, useRef } from "react";
import imageCompression from "browser-image-compression";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════
// TicketPhotoUpload
//
// Upload multi-photos avec compression côté client.
// • Max 1920px, qualité 0.8, format JPEG (heic → jpeg conversion)
// • Upload direct vers Storage bucket tickets-photos
// • Génère un chemin unique sous {commune_id}/{uuid}.jpg
// • Renvoie la liste des storage_path à enregistrer côté serveur
//
// Pas de upload pre-ticket : on stocke d'abord dans bucket, puis
// on associe via insert ticket_photos après création du ticket.
// ═══════════════════════════════════════════════════════════════

interface PhotoEntry {
  id: string;                 // local id (uuid)
  file: File;
  previewUrl: string;
  storagePath?: string;       // rempli après upload
  uploading: boolean;
  error?: string;
}

interface Props {
  communeId: string;
  onChange: (storagePaths: string[]) => void;
  max?: number;
  /** Mode : signalement (défaut) ou service_fait (pour la clôture) */
  type?: "signalement" | "service_fait";
}

export default function TicketPhotoUpload({ communeId, onChange, max = 5 }: Props) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateParent = useCallback((next: PhotoEntry[]) => {
    onChange(next.filter((p) => p.storagePath).map((p) => p.storagePath!));
  }, [onChange]);

  async function compressAndUpload(entry: PhotoEntry): Promise<PhotoEntry> {
    try {
      const compressed = await imageCompression(entry.file, {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.8,
      });

      const ext = "jpg";
      const path = `${communeId}/${entry.id}.${ext}`;

      const supabase = createClient();
      const { error } = await supabase.storage
        .from("tickets-photos")
        .upload(path, compressed, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/jpeg",
        });

      if (error) {
        return { ...entry, uploading: false, error: error.message };
      }
      return { ...entry, uploading: false, storagePath: path };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur upload";
      return { ...entry, uploading: false, error: msg };
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const remaining = Math.max(0, max - photos.length);
    const list = Array.from(files).slice(0, remaining);
    if (list.length === 0) return;

    const newEntries: PhotoEntry[] = list.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    }));

    const next = [...photos, ...newEntries];
    setPhotos(next);

    // Upload en parallèle
    const uploaded = await Promise.all(newEntries.map(compressAndUpload));
    setPhotos((prev) => {
      const merged = prev.map((p) => uploaded.find((u) => u.id === p.id) ?? p);
      updateParent(merged);
      return merged;
    });
  }

  function removeOne(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      // Si déjà uploadé, on supprime aussi de Storage
      if (target?.storagePath) {
        const supabase = createClient();
        supabase.storage.from("tickets-photos").remove([target.storagePath]).catch(() => {});
      }
      const next = prev.filter((p) => p.id !== id);
      updateParent(next);
      return next;
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        style={{ display: "none" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
        {photos.map((p) => (
          <div key={p.id} className="tk-photo-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt="" />
            {p.uploading && (
              <div className="tk-photo-overlay">
                <Loader2 size={20} className="civiq-spin" style={{ color: "#fff" }} />
              </div>
            )}
            {p.error && (
              <div className="tk-photo-overlay" style={{ background: "rgba(239,68,68,0.85)", color: "#fff", fontSize: 11, padding: 4, textAlign: "center" }}>
                {p.error}
              </div>
            )}
            <button
              type="button"
              onClick={() => removeOne(p.id)}
              className="tk-photo-remove"
              aria-label="Supprimer la photo"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="tk-photo-add"
          >
            {photos.length === 0 ? (
              <>
                <Camera size={20} />
                <span>Prendre / ajouter</span>
              </>
            ) : (
              <ImagePlus size={20} />
            )}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 6 }}>
        {photos.length}/{max} photo{max > 1 ? "s" : ""} · compression auto à 1920px max.
      </p>

      <style>{`
        .tk-photo-thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--border-light);
        }
        .tk-photo-thumb img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .tk-photo-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.4);
        }
        .tk-photo-remove {
          position: absolute; top: 4px; right: 4px;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(0,0,0,0.6); color: #fff;
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .tk-photo-remove:hover { background: rgba(0,0,0,0.8); }
        .tk-photo-add {
          aspect-ratio: 1;
          border: 2px dashed var(--border);
          border-radius: var(--radius-sm);
          background: var(--card);
          color: var(--fg-muted);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 6px; cursor: pointer; font-family: inherit;
          font-size: 11px; font-weight: 500;
          transition: border-color var(--transition), color var(--transition);
        }
        .tk-photo-add:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}

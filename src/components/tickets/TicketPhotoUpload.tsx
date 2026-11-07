"use client";

import { useState, useCallback, useRef } from "react";
import { Camera, X, Loader2, ImagePlus, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { cheminMiniature } from "@/lib/tickets/pieces";
import { compresserPhoto, deposerPhoto } from "@/lib/tickets/depot-photo";
import { estErreurReseau } from "@/lib/tickets/hors-ligne-regles";

// ═══════════════════════════════════════════════════════════════
// TicketPhotoUpload
//
// Upload multi-photos avec compression côté client.
// • Max 1920px, qualité 0.8, format JPEG (heic → jpeg conversion)
// • Upload direct vers Storage bucket tickets-photos
// • Génère un chemin unique sous {commune_id}/{uuid}.jpg
// • Dépose aussi une miniature (480 px) sous {commune_id}/miniatures/
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
  /** Hors ligne (lot 3) : photo compressée gardée pour un envoi différé. */
  enAttente?: Blob;
  uploading: boolean;
  error?: string;
}

interface Props {
  communeId: string;
  onChange: (storagePaths: string[]) => void;
  max?: number;
  /** Mode : signalement (défaut) ou service_fait (pour la clôture) */
  type?: "signalement" | "service_fait";
  /**
   * Hors ligne (lot 3) : reçoit les photos compressées qui n'ont pas pu
   * être déposées. Sans ce rappel, une photo hors ligne reste en erreur.
   */
  onEnAttente?: (photos: Blob[]) => void;
}

export default function TicketPhotoUpload({ communeId, onChange, max = 5, onEnAttente }: Props) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const updateParent = useCallback((next: PhotoEntry[]) => {
    onChange(next.filter((p) => p.storagePath).map((p) => p.storagePath!));
    onEnAttente?.(next.filter((p) => p.enAttente).map((p) => p.enAttente!));
  }, [onChange, onEnAttente]);

  async function compressAndUpload(entry: PhotoEntry): Promise<PhotoEntry> {
    let compressed: Blob;
    try {
      compressed = await compresserPhoto(entry.file);
    } catch (err) {
      return { ...entry, uploading: false, error: err instanceof Error ? err.message : "Photo illisible" };
    }
    // Hors ligne : la photo attend l'envoi du signalement (si le parent le gère)
    if (onEnAttente && typeof navigator !== "undefined" && !navigator.onLine) {
      return { ...entry, uploading: false, enAttente: compressed };
    }
    try {
      const path = await deposerPhoto(communeId, compressed, entry.id);
      return { ...entry, uploading: false, storagePath: path };
    } catch (err) {
      if (onEnAttente && estErreurReseau(err, navigator.onLine)) return { ...entry, uploading: false, enAttente: compressed };
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
        const mini = cheminMiniature(target.storagePath);
        supabase.storage.from("tickets-photos")
          .remove(mini ? [target.storagePath, mini] : [target.storagePath])
          .catch(() => {});
      }
      const next = prev.filter((p) => p.id !== id);
      updateParent(next);
      return next;
    });
  }

  const canAdd = photos.length < max;
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleInputChange}
        style={{ display: "none" }}
      />

      {canAdd && (
        <div className="tk-photo-actions">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="civiq-btn civiq-btn-outline tk-photo-action-btn"
          >
            <Camera size={16} />
            <span>Appareil photo</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="civiq-btn civiq-btn-outline tk-photo-action-btn"
          >
            <FolderOpen size={16} />
            <span>Galerie / fichiers</span>
          </button>
        </div>
      )}

      <div className="tk-photo-grid">
        {photos.map((p) => (
          <div key={p.id} className="tk-photo-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt="" />
            {p.uploading && (
              <div className="tk-photo-overlay">
                <Loader2 size={20} className="civiq-spin" style={{ color: "#fff" }} />
              </div>
            )}
            {p.enAttente && (
              <div className="tk-photo-overlay" style={{ alignItems: "flex-end", background: "linear-gradient(transparent 55%, rgba(0,0,0,0.65))", color: "#fff", fontSize: 11, fontWeight: 600, padding: 6 }}>
                Envoi au retour du réseau
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

        {canAdd && photos.length > 0 && (
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="tk-photo-add"
            aria-label="Ajouter une photo"
          >
            <ImagePlus size={20} />
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 8 }}>
        {photos.length}/{max} photo{max > 1 ? "s" : ""} · compression auto à 1920px max.
      </p>

      <style>{`
        .tk-photo-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .tk-photo-action-btn {
          width: 100%;
          justify-content: center;
          min-height: 48px;
          font-size: 13.5px;
        }
        .tk-photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 8px;
        }
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

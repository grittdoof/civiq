"use client";

import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase-browser";
import { MINIATURE_PX, cheminMiniature } from "./pieces";

// ═══════════════════════════════════════════════════════════════
// Photos de signalement côté navigateur : compression puis dépôt
// dans `tickets-photos` sous `<commune>/<uuid>.jpg` (+ miniature).
// Partagé par TicketPhotoUpload et l'envoi différé (hors ligne, lot 3).
// ═══════════════════════════════════════════════════════════════

/** Compresse une photo en JPEG (1920 px, ~1,5 Mo). */
export async function compresserPhoto(fichier: Blob): Promise<Blob> {
  const f = fichier instanceof File ? fichier : new File([fichier], "photo.jpg", { type: fichier.type || "image/jpeg" });
  return imageCompression(f, {
    maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.8,
  });
}

/**
 * Dépose une photo déjà compressée et sa miniature ; renvoie le chemin
 * à enregistrer sur le signalement. La miniature est facultative.
 */
export async function deposerPhoto(communeId: string, photo: Blob, id: string = crypto.randomUUID()): Promise<string> {
  const path = `${communeId}/${id}.jpg`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("tickets-photos").upload(path, photo, {
    cacheControl: "3600", upsert: false, contentType: "image/jpeg",
  });
  if (error) throw new Error(error.message);

  const mini = cheminMiniature(path);
  if (mini) {
    try {
      const f = photo instanceof File ? photo : new File([photo], "photo.jpg", { type: "image/jpeg" });
      const petite = await imageCompression(f, {
        maxSizeMB: 0.08, maxWidthOrHeight: MINIATURE_PX, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.75,
      });
      await supabase.storage.from("tickets-photos").upload(mini, petite, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
    } catch { /* sans miniature : la photo entière sert de vignette */ }
  }
  return path;
}

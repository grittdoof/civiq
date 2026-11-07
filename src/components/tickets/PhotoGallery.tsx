"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Galerie de photos d'un signalement + visionneuse plein écran (lot 6).
// Les vignettes chargent la miniature ; la visionneuse charge la
// photo entière. Toutes les adresses sont celles de nos routes
// (/api/tickets/<id>/photos/<photo>) : elles ne périment jamais.
// Clavier : Échap ferme, ← → naviguent. Mobile : balayage.
// ═══════════════════════════════════════════════════════════════

export interface PhotoGalerie {
  id: string;
  /** Photo entière. */
  src: string;
  /** Vignette (miniature si elle existe, sinon photo entière côté serveur). */
  miniature: string;
  /** Même photo, en téléchargement. */
  telecharger: string;
  legende?: string | null;
  date?: string | null;
}

export default function PhotoGallery({ photos, titre }: { photos: PhotoGalerie[]; titre: string }) {
  const [ouverte, setOuverte] = useState<number | null>(null);
  const declencheur = useRef<HTMLButtonElement | null>(null);
  const fermerRef = useRef<HTMLButtonElement | null>(null);
  const toucheDebut = useRef<number | null>(null);

  const fermer = useCallback(() => {
    setOuverte(null);
    declencheur.current?.focus();
  }, []);
  const decaler = useCallback((pas: number) => {
    setOuverte((i) => (i === null ? i : (i + pas + photos.length) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (ouverte === null) return;
    fermerRef.current?.focus();
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
      else if (e.key === "ArrowRight") decaler(1);
      else if (e.key === "ArrowLeft") decaler(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [ouverte, fermer, decaler]);

  if (photos.length === 0) return null;
  const courante = ouverte === null ? null : photos[ouverte];

  return (
    <>
      <ul className="tk-photo-gallery" aria-label={titre}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className="tk-galerie-vignette"
              aria-label={`Agrandir la photo ${i + 1} sur ${photos.length}${p.legende ? ` : ${p.legende}` : ""}`}
              onClick={(e) => { declencheur.current = e.currentTarget; setOuverte(i); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.miniature} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {courante && ouverte !== null && (
        <div
          className="tk-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${titre} — photo ${ouverte + 1} sur ${photos.length}`}
          onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}
          onTouchStart={(e) => { toucheDebut.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            const debut = toucheDebut.current;
            const fin = e.changedTouches[0]?.clientX;
            toucheDebut.current = null;
            if (debut == null || fin == null || Math.abs(fin - debut) < 50) return;
            decaler(fin < debut ? 1 : -1);
          }}
        >
          <div className="tk-lightbox-bar">
            <button ref={fermerRef} type="button" className="tk-lightbox-btn" onClick={fermer} aria-label="Fermer la visionneuse">
              <X size={20} aria-hidden="true" />
            </button>
            <span className="tk-lightbox-count" aria-live="polite">{ouverte + 1} / {photos.length}</span>
            <span style={{ width: 44 }} aria-hidden="true" />
          </div>

          <div className="tk-lightbox-stage" onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}>
            {photos.length > 1 && (
              <button type="button" className="tk-lightbox-btn tk-lightbox-prev" onClick={() => decaler(-1)} aria-label="Photo précédente">
                <ChevronLeft size={24} aria-hidden="true" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={courante.id} src={courante.src} alt={courante.legende ?? `Photo ${ouverte + 1}`} className="tk-lightbox-img" />
            {photos.length > 1 && (
              <button type="button" className="tk-lightbox-btn tk-lightbox-next" onClick={() => decaler(1)} aria-label="Photo suivante">
                <ChevronRight size={24} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="tk-lightbox-foot">
            {(courante.legende || courante.date) && (
              <p className="tk-lightbox-caption">
                {[courante.legende, courante.date].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="tk-lightbox-actions">
              <a className="tk-lightbox-action" href={courante.src} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" /> Ouvrir en grand
              </a>
              <a className="tk-lightbox-action tk-lightbox-action-primary" href={courante.telecharger}>
                <Download size={16} aria-hidden="true" /> Télécharger
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

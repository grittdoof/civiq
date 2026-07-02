"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// RightDrawer — primitif de panneau droit (off-canvas, style Airbnb).
//
//   • Ouverture contrôlée par `open` prop
//   • Fermeture au click backdrop, touche Esc ou bouton X
//   • Scroll body verrouillé quand ouvert
//   • Animation slide depuis la droite
//
// Usage :
//   <RightDrawer open={open} onClose={() => setOpen(false)} title="Filtres">
//     …contenu…
//   </RightDrawer>
// ═══════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Largeur en px (default 380). Ignoré sur mobile (100vw). */
  width?: number;
  /** Contenu de bas de panneau (actions, boutons). Optionnel. */
  footer?: React.ReactNode;
}

export default function RightDrawer({ open, onClose, title, children, width = 380, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className={`pj-drawer-root${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div
        className="pj-drawer-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="pj-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ["--pj-drawer-w" as string]: `${width}px` }}
      >
        <header className="pj-drawer-head">
          <h2 className="pj-drawer-title">{title}</h2>
          <button
            type="button"
            className="pj-drawer-close"
            onClick={onClose}
            aria-label="Fermer le panneau"
          >
            <X size={18} />
          </button>
        </header>
        <div className="pj-drawer-body">{children}</div>
        {footer && <div className="pj-drawer-footer">{footer}</div>}
      </aside>
    </div>
  );
}

"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// CollapsibleSection — section pliable (progressive disclosure)
// pour la fiche projet. Animation grid-template-rows 0fr ↔ 1fr
// (technique sans hauteur fixe) + chevron qui pivote.
//
// NB : l'icône est passée en JSX (ReactNode) déjà rendue par le
// parent, et non en référence de composant. C'est obligatoire car
// ce composant est un Client Component appelé depuis un Server
// Component — les fonctions ne sont pas sérialisables au boundary.
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  /** Icône déjà rendue en JSX (ex : <Target size={16} />) */
  icon?: ReactNode;
  /** Petit compteur affiché à côté du titre (ex : « 5 jalons ») */
  count?: number;
  /** Sous-texte explicatif (storytelling — pourquoi cette section ?) */
  hint?: string;
  /** Slot pour insérer un badge / élément à droite du titre */
  endSlot?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function CollapsibleSection({
  title,
  icon,
  count,
  hint,
  endSlot,
  defaultOpen = true,
  className,
  style,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`civiq-card pj-collapsible${
        className ? " " + className : ""
      }${open ? " is-open" : ""}`}
      style={style}
    >
      <button
        type="button"
        className="pj-collapsible-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {icon && (
          <span className="pj-collapsible-icon" aria-hidden>
            {icon}
          </span>
        )}
        <span className="pj-collapsible-title-block">
          <span className="pj-collapsible-title">
            {title}
            {typeof count === "number" && (
              <span className="pj-collapsible-count">{count}</span>
            )}
          </span>
          {hint && !open && (
            <span className="pj-collapsible-hint-closed">{hint}</span>
          )}
        </span>
        {endSlot && (
          <span className="pj-collapsible-end" onClick={(e) => e.stopPropagation()}>
            {endSlot}
          </span>
        )}
        <span className="pj-collapsible-chevron" aria-hidden>
          <ChevronDown size={16} />
        </span>
      </button>

      <div className="pj-collapsible-body" data-open={open} aria-hidden={!open}>
        <div className="pj-collapsible-body-inner">
          {hint && open && (
            <p className="pj-collapsible-hint-open">{hint}</p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════
// ProjectSection — section de fiche projet à plat (RSC, sans JS).
//
// Apple-style :
//   - une section = une card pleine largeur, contenu toujours
//     visible (pas de pliage qui désoriente les débutants)
//   - en-tête simple : pastille icône + titre + compteur + hint
//   - breathing room généreux (22 px padding, 14 px gap entre cards)
//
// Pas de Client Component → l'icône peut être un ReactNode résolu
// par le serveur (typique : <Target size={16} />).
// ═══════════════════════════════════════════════════════════════

interface Props {
  title: string;
  icon?: ReactNode;
  count?: number;
  /** Phrase courte qui explique la section pour un débutant. */
  hint?: string;
  /** Slot pour un badge / petit élément à droite du titre. */
  endSlot?: ReactNode;
  /** id HTML pour les anchors de navigation depuis PhaseGuide. */
  id?: string;
  className?: string;
  children: ReactNode;
}

export default function ProjectSection({
  title,
  icon,
  count,
  hint,
  endSlot,
  id,
  className,
  children,
}: Props) {
  return (
    <section
      id={id}
      className={`civiq-card pj-flat-section${
        className ? " " + className : ""
      }`}
    >
      <header className="pj-flat-section-head">
        {icon && (
          <span className="pj-flat-section-icon" aria-hidden>
            {icon}
          </span>
        )}
        <div className="pj-flat-section-title-block">
          <h2 className="pj-flat-section-title">
            {title}
            {typeof count === "number" && (
              <span className="pj-flat-section-count">{count}</span>
            )}
          </h2>
          {hint && <p className="pj-flat-section-hint">{hint}</p>}
        </div>
        {endSlot && (
          <span className="pj-flat-section-end">{endSlot}</span>
        )}
      </header>
      <div className="pj-flat-section-body">{children}</div>
    </section>
  );
}

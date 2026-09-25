"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// « En savoir plus » repliable (doctrine pédagogique, règle n°6) :
// texte réel (pas de title / tooltip), bouton focusable avec
// aria-expanded + aria-controls. Le fondement juridique vient ici,
// jamais en première position.
// ═══════════════════════════════════════════════════════════════

export default function LearnMore({ children, label = "En savoir plus" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="pj-learn-more">
      <button
        type="button"
        className="pj-learn-more-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" className={open ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
      </button>
      <div id={id} className="pj-learn-more-body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

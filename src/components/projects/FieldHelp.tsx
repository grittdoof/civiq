"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Microcopie juste-à-temps (doctrine, règle n°5) : l'explication d'un
// champ est ouverte les trois premières fois, puis se replie ; elle
// reste réouvrable via « ? ». Texte réel, bouton focusable, aria-expanded.
// Compteur par navigateur (localStorage) — best effort.
// ═══════════════════════════════════════════════════════════════

const MAX_VUES = 3;

export default function FieldHelp({ id, children }: { id: string; children: ReactNode }) {
  const key = `civiq:aide:${id}`;
  const [open, setOpen] = useState(true);
  const regionId = useId();

  useEffect(() => {
    try {
      const vues = Number(localStorage.getItem(key) ?? "0");
      if (vues >= MAX_VUES) setOpen(false);
      localStorage.setItem(key, String(vues + 1));
    } catch {
      /* stockage indisponible : l'aide reste ouverte */
    }
  }, [key]);

  return (
    <div className="pj-field-help">
      <button
        type="button"
        className="pj-field-help-toggle"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((o) => !o)}
      >
        <HelpCircle size={14} aria-hidden="true" />
        <span className="pj-sr-only">{open ? "Masquer l'explication" : "Afficher l'explication"}</span>
      </button>
      <div id={regionId} className="pj-field-help-body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

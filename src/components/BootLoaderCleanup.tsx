"use client";

import { useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// BootLoaderCleanup
//
// Retire le boot loader (#civiq-boot rendu par SSR dans layout.tsx)
// dès que React est hydraté. Le loader est présent immédiatement à
// l'ouverture (visible en 0 s au lieu du blank 3-5 s du lancement
// PWA), et disparaît en fondu quand ce composant monte.
//
// Client-only — un `<script>` inline dans l'App Router n'exécute
// pas toujours ; passer par un effet React est le chemin fiable.
// ═══════════════════════════════════════════════════════════════

export default function BootLoaderCleanup() {
  useEffect(() => {
    const el = document.getElementById("civiq-boot");
    if (!el) return;
    // Fondu puis retrait complet du DOM
    el.classList.add("civiq-boot-hidden");
    const t = window.setTimeout(() => {
      el.parentNode?.removeChild(el);
    }, 320);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

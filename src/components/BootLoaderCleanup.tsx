"use client";

import { useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// BootLoaderCleanup
//
// Cache le boot loader (#civiq-boot rendu par SSR dans layout.tsx)
// dès que React est hydraté. Le loader est présent immédiatement
// à l'ouverture (visible en 0 s au lieu du blank 3-5 s du lancement
// PWA), et devient invisible en fondu quand ce composant monte.
//
// ⚠ Ne PAS retirer le noeud du DOM (removeChild). Le div est un
// enfant JSX du layout — React en est propriétaire. Le retirer
// manuellement invalide sa fiber tree et provoque une NotFoundError
// au prochain insertBefore de React (observé sur iOS Safari 18).
// On se contente d'ajouter la classe qui rend le noeud invisible
// + inerte via CSS. Un div hidden vide n'a aucun coût.
// ═══════════════════════════════════════════════════════════════

export default function BootLoaderCleanup() {
  useEffect(() => {
    const el = document.getElementById("civiq-boot");
    if (!el) return;
    el.classList.add("civiq-boot-hidden");
  }, []);
  return null;
}

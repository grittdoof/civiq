"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CLE_NAV_COURANT, CLE_NAV_PRECEDENT } from "@/lib/navigation/retour";

// Mémorise la page courante et la précédente (onglet du navigateur
// uniquement) pour les boutons « retour » selon le parcours.
export default function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const ici = `${window.location.pathname}${window.location.search}`;
      const courant = sessionStorage.getItem(CLE_NAV_COURANT);
      if (courant === ici) return;
      if (courant && courant.split("?")[0] !== window.location.pathname) sessionStorage.setItem(CLE_NAV_PRECEDENT, courant);
      sessionStorage.setItem(CLE_NAV_COURANT, ici);
    } catch { /* stockage indisponible : retour par défaut */ }
  }, [pathname]);
  return null;
}

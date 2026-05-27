"use client";

import { useEffect } from "react";

// Déclenche automatiquement la boîte d'impression à l'ouverture.
// Utilisé quand on arrive sur la page via ?auto=1 depuis le bouton
// "Imprimer / PDF" de la liste des tickets.
export default function PrintAutoTrigger() {
  useEffect(() => {
    // Petit délai pour laisser les images charger
    const t = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(t);
  }, []);
  return null;
}

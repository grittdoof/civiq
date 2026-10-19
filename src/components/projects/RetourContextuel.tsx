"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  CLE_NAV_COURANT, CLE_NAV_PRECEDENT, RETOUR_PROJETS, cleRetour, pageDOrigine, retourDepuis, type Retour,
} from "@/lib/navigation/retour";

// Bouton retour d'une page de projet : renvoie là d'où l'on vient
// (commission, séance, calendrier, signalement, liste filtrée…), et le
// garde en mémoire tant qu'on navigue dans le projet (onglets, édition).

export default function RetourContextuel({ base }: { base: string }) {
  const [retour, setRetour] = useState<Retour>(RETOUR_PROJETS);

  useEffect(() => {
    try {
      const ici = `${window.location.pathname}${window.location.search}`;
      const origine = pageDOrigine(ici, {
        courant: sessionStorage.getItem(CLE_NAV_COURANT),
        precedent: sessionStorage.getItem(CLE_NAV_PRECEDENT),
      });
      const trouve = retourDepuis(origine, base);
      if (trouve) {
        sessionStorage.setItem(cleRetour(base), JSON.stringify(trouve));
        setRetour(trouve);
        return;
      }
      const memo = sessionStorage.getItem(cleRetour(base));
      if (memo) setRetour(JSON.parse(memo) as Retour);
    } catch { /* stockage indisponible : « Tous les projets » */ }
  }, [base]);

  return (
    <Link href={retour.href} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
      <ArrowLeft size={14} aria-hidden="true" /> {retour.label}
    </Link>
  );
}

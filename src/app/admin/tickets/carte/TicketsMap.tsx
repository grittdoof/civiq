"use client";

import dynamic from "next/dynamic";
import type { TicketPriorite, TicketStatut, TicketCategorie } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Wrapper Client : charge la carte Leaflet uniquement côté navigateur
// pour éviter les erreurs SSR (« window is not defined »).
// ═══════════════════════════════════════════════════════════════

export interface MapTicket {
  id: string;
  numero: number;
  titre: string;
  priorite: TicketPriorite;
  statut: TicketStatut;
  categorie: TicketCategorie;
  latitude: number;
  longitude: number;
  adresse: string | null;
  photoUrl: string | null;
}

const Inner = dynamic(() => import("./TicketsMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "calc(100vh - 180px)", minHeight: 400,
      borderRadius: "var(--radius-sm)", background: "var(--border-light)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--fg-muted)", fontSize: 13,
    }}>
      Chargement de la carte…
    </div>
  ),
});

export default function TicketsMap(props: { center: [number, number]; tickets: MapTicket[] }) {
  return <Inner {...props} />;
}

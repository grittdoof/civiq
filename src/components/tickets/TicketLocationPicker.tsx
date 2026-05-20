"use client";

import dynamic from "next/dynamic";
import type { LocationValue } from "./TicketLocationPickerInner";

// Leaflet n'est pas SSR-friendly → on charge le composant uniquement
// côté client via dynamic import.
const Inner = dynamic(() => import("./TicketLocationPickerInner"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 380, borderRadius: "var(--radius-sm)",
      background: "var(--border-light)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--fg-muted)", fontSize: 13,
    }}>
      Chargement de la carte…
    </div>
  ),
});

export type { LocationValue };
export default Inner;

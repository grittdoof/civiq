"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { TicketPriorite } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// TicketLocationMap — Mini-carte Leaflet avec un marqueur unique
// pour le détail d'un ticket. Tap sur le marker → ouvre dans une
// nouvelle tab via Google Maps.
// ═══════════════════════════════════════════════════════════════

interface Props {
  lat: number;
  lng: number;
  priorite?: TicketPriorite;
  /** Légende affichée dans le popup */
  label?: string;
  /** Hauteur (par défaut 240px) */
  height?: number;
}

const COLOR_BY_PRIORITE: Record<TicketPriorite, string> = {
  basse:    "#6B7280",
  normale:  "#3B82F6",
  haute:    "#F59E0B",
  urgente:  "#EF4444",
};

export default function TicketLocationMap({
  lat, lng, priorite = "normale", label, height = 240,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = await import("leaflet");

      map = L.map(containerRef.current!, {
        center: [lat, lng],
        zoom: 16,
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const color = COLOR_BY_PRIORITE[priorite] || "#3B82F6";
      const ringColor = priorite === "urgente" ? "rgba(239, 68, 68, 0.18)" : "rgba(0, 0, 0, 0.08)";

      // Pulse ring (cercle plus large)
      L.circleMarker([lat, lng], {
        radius: 22,
        fillColor: color,
        color: "transparent",
        fillOpacity: 0.14,
      }).addTo(map);

      // Marker principal
      const marker = L.circleMarker([lat, lng], {
        radius: 11,
        fillColor: color,
        color: "#fff",
        weight: 2.5,
        fillOpacity: 1,
        opacity: 1,
      }).addTo(map);

      // Halo blanc autour
      L.circleMarker([lat, lng], {
        radius: 14,
        fillColor: "transparent",
        color: ringColor,
        weight: 6,
        fillOpacity: 0,
      }).addTo(map);

      if (label) {
        marker.bindPopup(
          `<div style="font-family:'Montserrat',sans-serif;font-size:13px;line-height:1.4">
             <strong>${escapeHtml(label)}</strong>
             <div style="margin-top:6px">
               <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}"
                  target="_blank" rel="noreferrer"
                  style="color:#2F6FDB;font-weight:600;text-decoration:none">
                 Ouvrir dans Google Maps ↗
               </a>
             </div>
           </div>`
        );
      }
    })();

    return () => {
      map?.remove();
    };
  }, [lat, lng, priorite, label]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ? `Carte : ${label}` : "Carte de localisation"}
      style={{
        width: "100%",
        height,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]!));
}

"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════
// EVENT MAP — mini-carte Leaflet du lieu d'un événement.
// Tuiles OpenStreetMap (aucune clé d'API, déjà autorisées par la
// CSP du projet, cf. next.config.ts).
// ═══════════════════════════════════════════════════════════════

interface EventMapProps {
  lat: number;
  lng: number;
  label?: string;
  /** Couleur du marqueur (couleur primaire de la commune) */
  color?: string;
  height?: number;
  /** Affiche les contrôles de zoom (désactivés dans les aperçus compacts) */
  interactive?: boolean;
}

export default function EventMap({
  lat,
  lng,
  label,
  color = "#1a2744",
  height = 200,
  interactive = true,
}: EventMapProps) {
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
        zoomControl: interactive,
        dragging: interactive,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 20,
        fillColor: color,
        color: "transparent",
        fillOpacity: 0.14,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: color,
        color: "#fff",
        weight: 2.5,
        fillOpacity: 1,
      }).addTo(map);
    })();

    return () => {
      map?.remove();
    };
  }, [lat, lng, color, interactive]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ? `Carte : ${label}` : "Carte du lieu de l'événement"}
      style={{ width: "100%", height }}
    />
  );
}

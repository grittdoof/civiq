"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════
// HeatmapMap — Carte Leaflet avec markers colorés selon priorité
// (heatmap simplifié sans dépendance leaflet.heat pour V1)
// ═══════════════════════════════════════════════════════════════

interface Point {
  lat: number;
  lng: number;
  weight: number; // 1 (basse) → 3 (urgente)
}

const CHATEAUNEUF_CENTER: [number, number] = [46.881, -1.978];

export default function HeatmapMap({ points }: { points: Point[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = await import("leaflet");

      // Centre = barycentre des points si suffisamment, sinon Châteauneuf
      const center: [number, number] =
        points.length >= 3
          ? [
              points.reduce((s, p) => s + p.lat, 0) / points.length,
              points.reduce((s, p) => s + p.lng, 0) / points.length,
            ]
          : CHATEAUNEUF_CENTER;

      map = L.map(containerRef.current!, {
        center,
        zoom: 14,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Cercles colorés par poids (= priorité)
      points.forEach((p) => {
        const color =
          p.weight >= 3 ? "#EF4444" :
          p.weight >= 2 ? "#F59E0B" : "#3B82F6";
        const radius =
          p.weight >= 3 ? 14 :
          p.weight >= 2 ? 11 : 8;
        L.circleMarker([p.lat, p.lng], {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          fillOpacity: 0.7,
        }).addTo(map!);
      });
    })();

    return () => {
      map?.remove();
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 340,
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}

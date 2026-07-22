"use client";

import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════
// EVENT LOCATION PICKER — back-office
//
// Placement manuel du lieu d'un événement : clic sur la carte ou
// glissement du curseur. Complète la recherche par adresse, qui ne
// tombe pas toujours sur la bonne entrée (salle municipale, parking,
// entrée d'un parc…).
//
// Leaflet est piloté en impératif (comme EventMap / TicketLocationMap)
// pour éviter que la carte ne se réinitialise à chaque frappe dans le
// formulaire parent.
// ═══════════════════════════════════════════════════════════════

interface EventLocationPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  /** Centre par défaut quand aucun point n'est encore placé (France) */
  defaultCenter?: [number, number];
  height?: number;
}

export default function EventLocationPicker({
  lat,
  lng,
  onChange,
  defaultCenter = [46.6, 2.4],
  height = 260,
}: EventLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  // Le parent recrée le callback à chaque rendu : on le lit via une ref
  // pour ne pas ré-attacher les handlers Leaflet.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasPoint = lat != null && lng != null;

  // ─── Initialisation (une seule fois) ───
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      // leaflet-icons importe Leaflet au chargement du module : import
      // dynamique obligatoire, sinon « window is not defined » au SSR.
      const [L, { fixLeafletIcons }] = await Promise.all([
        import("leaflet"),
        import("@/components/tickets/leaflet-icons"),
      ]);
      if (cancelled || !containerRef.current) return;
      fixLeafletIcons();

      const map = L.map(containerRef.current, {
        center: hasPoint ? [lat!, lng!] : defaultCenter,
        zoom: hasPoint ? 17 : 5,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        onChangeRef.current(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6))
        );
      });

      if (hasPoint) {
        markerRef.current = createMarker(L, map, lat!, lng!);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Initialisation unique — les mises à jour passent par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Synchronisation avec les coordonnées du parent ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasPoint) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    (async () => {
      const L = await import("leaflet");
      if (!mapRef.current) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat!, lng!]);
      } else {
        markerRef.current = createMarker(L, mapRef.current, lat!, lng!);
      }
      mapRef.current.setView([lat!, lng!], Math.max(mapRef.current.getZoom(), 16));
    })();
  }, [lat, lng, hasPoint]);

  function createMarker(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    y: number,
    x: number
  ) {
    const marker = L.marker([y, x], { draggable: true, autoPan: true }).addTo(map);
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      onChangeRef.current(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
    });
    return marker;
  }

  return (
    <div className="evt-picker">
      <div ref={containerRef} style={{ height }} />
      <span className="evt-picker-hint">
        <Crosshair size={11} />
        {hasPoint ? "Déplacez le curseur pour ajuster" : "Cliquez pour placer le lieu"}
      </span>

      <style>{`
        .evt-picker {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e8e5de;
        }
        .evt-picker-hint {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 500;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 6px;
          background: rgba(255,255,255,0.94);
          font-size: 11px;
          font-weight: 600;
          color: #666;
          pointer-events: none;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fix des icônes Leaflet pour Next.js
//
// Leaflet utilise des chemins relatifs vers ses PNG par défaut,
// qui ne fonctionnent pas en bundling moderne. On injecte les
// URLs CDN manuellement.
//
// À importer une fois côté client avant d'instancier une carte.
// ═══════════════════════════════════════════════════════════════

import L from "leaflet";

// Empêche le double-fix
let fixed = false;

export function fixLeafletIcons() {
  if (fixed) return;
  fixed = true;

  // @ts-expect-error _getIconUrl is internal but needs to be deleted
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Icônes colorées par priorité (SVG inline)
export function ticketIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
      <path d="M15 0c8.3 0 15 6.7 15 15 0 11-15 27-15 27S0 26 0 15C0 6.7 6.7 0 15 0z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="6" fill="#fff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "tk-marker",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  });
}

export const PRIORITE_HEX: Record<string, string> = {
  basse: "#6B7280",
  normale: "#3B82F6",
  haute: "#F59E0B",
  urgente: "#EF4444",
};

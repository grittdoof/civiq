"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { LocateFixed, MapPin, Search, Loader2, Crosshair } from "lucide-react";
import { searchAddress, reverseGeocode, formatShortAddress, type NominatimResult } from "@/lib/tickets/geocoding";
import { fixLeafletIcons } from "./leaflet-icons";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════
// TicketLocationPickerInner
//
// Composant Client uniquement (Leaflet n'est pas SSR-friendly).
// Importé via dynamic({ ssr: false }) dans TicketLocationPicker.tsx
//
// Trois modes complémentaires :
//   1. GPS auto (navigator.geolocation)
//   2. Recherche adresse (autocomplete Nominatim debounced 400ms)
//   3. Clic direct sur la carte
//
// Reverse geocoding au clic pour récupérer l'adresse textuelle.
// ═══════════════════════════════════════════════════════════════

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  adresse: string | null;
  precision_geo: "gps" | "adresse" | "manuelle" | null;
}

interface Props {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  /** Centre par défaut si pas de position (Châteauneuf 85710) */
  defaultCenter?: [number, number];
  /** Contexte utilisé pour biaiser la recherche d'adresse */
  searchContext?: string;
}

export default function TicketLocationPickerInner({
  value,
  onChange,
  defaultCenter = [46.881, -1.978],
  searchContext = "Châteauneuf, Vendée",
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [reverseBusy, setReverseBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fixLeafletIcons(); }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim() || search.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const data = await searchAddress(search.trim(), { context: searchContext, limit: 6 });
      setResults(data);
      setSearching(false);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchContext]);

  const setLocation = useCallback(async (lat: number, lng: number, source: "gps" | "manuelle", forceAddress?: string) => {
    onChange({ latitude: lat, longitude: lng, adresse: forceAddress ?? value.adresse, precision_geo: source });
    if (!forceAddress) {
      setReverseBusy(true);
      const r = await reverseGeocode(lat, lng);
      setReverseBusy(false);
      if (r) {
        onChange({
          latitude: lat, longitude: lng,
          adresse: formatShortAddress(r),
          precision_geo: source,
        });
      }
    }
  }, [onChange, value.adresse]);

  function pickFromSearch(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onChange({
      latitude: lat, longitude: lng,
      adresse: formatShortAddress(r),
      precision_geo: "adresse",
    });
    setSearch(formatShortAddress(r));
    setResults([]);
  }

  function useGPS() {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsBusy(false);
        await setLocation(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        setGpsBusy(false);
        alert("Géolocalisation refusée ou indisponible : " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  const center: [number, number] =
    value.latitude && value.longitude ? [value.latitude, value.longitude] : defaultCenter;

  return (
    <div>
      {/* Boutons rapides */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={useGPS}
          disabled={gpsBusy}
          className="civiq-btn civiq-btn-default civiq-btn-sm"
          style={{ flex: 1, justifyContent: "center", minWidth: 160 }}
        >
          {gpsBusy ? <Loader2 size={13} className="civiq-spin" /> : <LocateFixed size={13} />}
          {gpsBusy ? "Localisation…" : "📍 Utiliser ma position"}
        </button>
      </div>

      {/* Recherche adresse */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <Search
          size={14}
          style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)", pointerEvents: "none" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une adresse…"
          className="civiq-input"
          style={{ paddingLeft: 32 }}
        />
        {results.length > 0 && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", boxShadow: "0 4px 16px oklch(0 0 0 / 0.08)",
            zIndex: 10, maxHeight: 240, overflowY: "auto",
          }}>
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => pickFromSearch(r)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "8px 10px", width: "100%", textAlign: "left",
                  background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                  fontFamily: "inherit", fontSize: 12.5,
                  color: "var(--fg)",
                }}
              >
                <MapPin size={13} style={{ color: "var(--fg-muted)", marginTop: 2, flexShrink: 0 }} />
                <span style={{ lineHeight: 1.4 }}>{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
        {searching && (
          <Loader2 size={14} className="civiq-spin" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)" }} />
        )}
      </div>

      {/* Carte */}
      <div style={{
        height: 280, borderRadius: "var(--radius-sm)", overflow: "hidden",
        border: "1px solid var(--border)", position: "relative",
      }}>
        <MapContainer
          center={center}
          zoom={value.latitude ? 17 : 15}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={(lat, lng) => setLocation(lat, lng, "manuelle")} />
          <CenterUpdater center={center} hasLocation={!!(value.latitude && value.longitude)} />
          {value.latitude && value.longitude && (
            <Marker
              position={[value.latitude, value.longitude]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  setLocation(ll.lat, ll.lng, "manuelle");
                },
              }}
            />
          )}
        </MapContainer>
        <div style={{
          position: "absolute", top: 8, right: 8, padding: "4px 8px",
          background: "rgba(255,255,255,0.95)", borderRadius: 6,
          fontSize: 11, color: "var(--fg-muted)",
          display: "flex", alignItems: "center", gap: 4,
          pointerEvents: "none",
        }}>
          <Crosshair size={11} /> Cliquez sur la carte
        </div>
      </div>

      {/* Résumé */}
      {value.latitude && value.longitude && (
        <div style={{
          marginTop: 8, padding: "8px 12px",
          background: "var(--accent-light)", borderRadius: "var(--radius-sm)",
          fontSize: 12, color: "var(--fg)",
        }}>
          {reverseBusy ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Loader2 size={11} className="civiq-spin" /> Recherche de l&apos;adresse…
            </span>
          ) : (
            <>
              <strong>{value.adresse || "Position sélectionnée"}</strong>
              <span style={{ display: "block", color: "var(--fg-muted)", fontFamily: "ui-monospace, monospace", fontSize: 11, marginTop: 2 }}>
                {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
                {value.precision_geo && <span style={{ marginLeft: 6 }}>· {value.precision_geo}</span>}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function CenterUpdater({ center, hasLocation }: { center: [number, number]; hasLocation: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (hasLocation) map.setView(center, Math.max(map.getZoom(), 16));
  }, [center, hasLocation, map]);
  return null;
}

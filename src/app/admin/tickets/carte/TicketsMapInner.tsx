"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { fixLeafletIcons, ticketIcon, PRIORITE_HEX } from "@/components/tickets/leaflet-icons";
import { PRIORITE_LABELS, STATUT_LABELS, CATEGORIE_ICONS, CATEGORIE_LABELS } from "@/lib/tickets/types";
import type { MapTicket } from "./TicketsMap";
import "leaflet/dist/leaflet.css";

// ═══════════════════════════════════════════════════════════════
// Vue cartographique des tickets — markers colorés par priorité.
//
// Note : on n'utilise pas react-leaflet-markercluster (pas encore
// stable avec react-leaflet 5). Pour de petites communes (~100
// tickets max), pas de problème de perf. À ajouter plus tard si
// nécessaire.
// ═══════════════════════════════════════════════════════════════

interface Props {
  center: [number, number];
  tickets: MapTicket[];
}

const FILTERS: Array<{ value: "tous" | "urgents" | "ouverts" | "clos"; label: string }> = [
  { value: "tous", label: "Tous" },
  { value: "ouverts", label: "Ouverts" },
  { value: "urgents", label: "Urgents" },
  { value: "clos", label: "Clos" },
];

export default function TicketsMapInner({ center, tickets }: Props) {
  const [filter, setFilter] = useState<"tous" | "urgents" | "ouverts" | "clos">("ouverts");

  useEffect(() => { fixLeafletIcons(); }, []);

  const filtered = useMemo(() => {
    if (filter === "tous") return tickets;
    if (filter === "urgents") return tickets.filter((t) => t.priorite === "urgente" && !["clos", "annule"].includes(t.statut));
    if (filter === "ouverts") return tickets.filter((t) => !["clos", "annule", "resolu"].includes(t.statut));
    if (filter === "clos") return tickets.filter((t) => ["clos", "resolu", "annule"].includes(t.statut));
    return tickets;
  }, [tickets, filter]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className="tk-pill"
            data-active={filter === f.value}
            onClick={() => setFilter(f.value)}
            style={filter === f.value ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined}
          >
            {f.label}
            <span className="tk-pill-count">
              {f.value === "tous" ? tickets.length :
                f.value === "urgents" ? tickets.filter((t) => t.priorite === "urgente" && !["clos", "annule"].includes(t.statut)).length :
                f.value === "ouverts" ? tickets.filter((t) => !["clos", "annule", "resolu"].includes(t.statut)).length :
                tickets.filter((t) => ["clos", "resolu", "annule"].includes(t.statut)).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{
        height: "calc(100vh - 220px)", minHeight: 420,
        borderRadius: "var(--radius-sm)", overflow: "hidden",
        border: "1px solid var(--border)", position: "relative",
      }}>
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filtered.map((t) => (
            <Marker
              key={t.id}
              position={[t.latitude, t.longitude]}
              icon={ticketIcon(PRIORITE_HEX[t.priorite] || "#3B82F6")}
            >
              <Popup minWidth={220} maxWidth={280}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.45 }}>
                  {t.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photoUrl} alt="" style={{
                      width: "100%", aspectRatio: "16/9", objectFit: "cover",
                      borderRadius: 4, marginBottom: 6,
                    }} />
                  )}
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#888" }}>#{t.numero}</div>
                  <div style={{ fontWeight: 600, color: "#1a2744", margin: "2px 0 6px" }}>{t.titre}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11, marginBottom: 6 }}>
                    <span style={{ background: "#f5f5f5", padding: "1px 8px", borderRadius: 99 }}>
                      {CATEGORIE_ICONS[t.categorie]} {CATEGORIE_LABELS[t.categorie]}
                    </span>
                    <span style={{
                      padding: "1px 8px", borderRadius: 99,
                      background: PRIORITE_HEX[t.priorite] + "22",
                      color: PRIORITE_HEX[t.priorite],
                      fontWeight: 600,
                    }}>
                      {PRIORITE_LABELS[t.priorite]}
                    </span>
                    <span style={{ background: "#f5f5f5", padding: "1px 8px", borderRadius: 99 }}>
                      {STATUT_LABELS[t.statut]}
                    </span>
                  </div>
                  {t.adresse && <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>{t.adresse}</div>}
                  <Link href={`/admin/tickets/${t.id}`} style={{
                    display: "inline-block", padding: "6px 12px",
                    background: "#1a2744", color: "#fff",
                    borderRadius: 6, textDecoration: "none",
                    fontSize: 12, fontWeight: 600,
                  }}>
                    Voir le détail →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Légende */}
        <div style={{
          position: "absolute", bottom: 12, left: 12,
          background: "rgba(255,255,255,0.95)",
          padding: "8px 12px", borderRadius: 8,
          fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          zIndex: 400,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#444" }}>Priorité</div>
          {Object.entries(PRIORITE_HEX).map(([key, color]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, color: "#666" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <span style={{ textTransform: "capitalize" }}>{key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

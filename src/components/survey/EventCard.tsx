"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, MapPin, Navigation, CalendarDays, Check } from "lucide-react";
import type { SurveyEvent } from "@/types/survey";
import {
  directionsUrl,
  downloadIcs,
  formatEventDate,
  googleCalendarUrl,
  hasLocation,
  locationLabel,
  mapUrl,
  outlookCalendarUrl,
} from "@/lib/survey-event";
import EventMap from "./EventMap";

// ═══════════════════════════════════════════════════════════════
// EVENT CARD — bloc événement du sondage-inscription
//
// Affiché sur l'écran d'accueil (avant le formulaire) et sur
// l'écran de remerciement (après inscription) : date, lieu, carte,
// itinéraire et ajout à l'agenda.
// ═══════════════════════════════════════════════════════════════

interface EventCardProps {
  event: SurveyEvent;
  title: string;
  /** Description reprise dans l'entrée d'agenda */
  description?: string;
  /** Lien public du sondage, ajouté à l'entrée d'agenda */
  url?: string;
  primaryColor: string;
  accentColor: string;
  /** Sur l'écran final, la carte est dépliée par défaut */
  variant?: "welcome" | "thanks";
}

function slugifyFilename(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "evenement"
  );
}

export default function EventCard({
  event,
  title,
  description,
  url,
  primaryColor,
  accentColor,
  variant = "welcome",
}: EventCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture du menu agenda au clic extérieur / Échap
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const payload = { title, description, url };
  const dateLabel = formatEventDate(event);
  const place = locationLabel(event.location);
  const coords =
    event.location?.lat != null && event.location?.lng != null
      ? { lat: event.location.lat, lng: event.location.lng }
      : null;
  const directions = directionsUrl(event.location);
  const map = mapUrl(event.location);
  const gcal = googleCalendarUrl(event, payload);
  const outlook = outlookCalendarUrl(event, payload);

  function handleIcs() {
    const ok = downloadIcs(event, payload, `${slugifyFilename(title)}.ics`);
    if (ok) {
      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    }
    setMenuOpen(false);
  }

  return (
    <div className="civiq-event-card">
      <div className="civiq-event-rows">
        {dateLabel && (
          <div className="civiq-event-row">
            <span
              className="civiq-event-icon"
              style={{ background: `${primaryColor}12`, color: primaryColor }}
              aria-hidden
            >
              <CalendarDays size={18} />
            </span>
            <div className="civiq-event-row-text">
              <strong>{dateLabel}</strong>
              {event.details && <span>{event.details}</span>}
            </div>
          </div>
        )}

        {hasLocation(event.location) && (
          <div className="civiq-event-row">
            <span
              className="civiq-event-icon"
              style={{ background: `${primaryColor}12`, color: primaryColor }}
              aria-hidden
            >
              <MapPin size={18} />
            </span>
            <div className="civiq-event-row-text">
              <strong>{event.location?.name || place}</strong>
              {event.location?.name && event.location?.address && (
                <span>{event.location.address}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {coords && (
        <div className="civiq-event-map">
          <EventMap
            lat={coords.lat}
            lng={coords.lng}
            label={place || title}
            color={primaryColor}
            height={variant === "thanks" ? 220 : 180}
          />
        </div>
      )}

      <div className="civiq-event-actions">
        <div className="civiq-event-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="civiq-event-btn primary"
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: primaryColor, color: "#fff" }}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {added ? <Check size={17} /> : <CalendarPlus size={17} />}
            {added ? "Ajouté à l'agenda" : "Ajouter à mon agenda"}
          </button>

          {menuOpen && (
            <div className="civiq-event-menu" role="menu">
              <button type="button" role="menuitem" onClick={handleIcs}>
                Apple Calendar / Autre (.ics)
              </button>
              {gcal && (
                <a
                  role="menuitem"
                  href={gcal}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                >
                  Google Agenda
                </a>
              )}
              {outlook && (
                <a
                  role="menuitem"
                  href={outlook}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                >
                  Outlook
                </a>
              )}
            </div>
          )}
        </div>

        {(directions || map) && (
          <a
            className="civiq-event-btn secondary"
            href={(variant === "thanks" ? directions : map) || directions || map || "#"}
            target="_blank"
            rel="noreferrer"
            style={{ borderColor: `${accentColor}66`, color: primaryColor }}
          >
            <Navigation size={17} />
            {variant === "thanks" ? "S'y rendre" : "Voir sur la carte"}
          </a>
        )}
      </div>
    </div>
  );
}

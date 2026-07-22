"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ImagePlus,
  Loader2,
  MapPin,
  Search,
  Trash2,
} from "lucide-react";
import type { SurveySchema, SurveyEvent, SurveyEventLocation } from "@/types/survey";
import { formatEventDate } from "@/lib/survey-event";
import EventMap from "./EventMap";

// ═══════════════════════════════════════════════════════════════
// EVENT SETTINGS PANEL — back-office
//
// Habillage du sondage (bannière, texte du bouton d'entrée) et mode
// « inscription à un événement » : date, lieu, carte. Tout est
// stocké dans schema.settings ; seule la bannière transite par
// l'API (upload dans le bucket survey-banners).
// ═══════════════════════════════════════════════════════════════

interface EventSettingsPanelProps {
  surveyId: string;
  schema: SurveySchema;
  onChange: (schema: SurveySchema) => void;
}

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export default function EventSettingsPanel({
  surveyId,
  schema,
  onChange,
}: EventSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geoResults, setGeoResults] = useState<GeocodeResult[] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const settings = schema.settings || {};
  const event: SurveyEvent = settings.event || {};
  const location: SurveyEventLocation = event.location || {};
  const eventOn = Boolean(event.enabled);

  function patchSettings(updates: Partial<typeof settings>) {
    onChange({ ...schema, settings: { ...settings, ...updates } });
  }

  function patchEvent(updates: Partial<SurveyEvent>) {
    patchSettings({ event: { ...event, ...updates } });
  }

  function patchLocation(updates: Partial<SurveyEventLocation>) {
    patchEvent({ location: { ...location, ...updates } });
  }

  // ─── Bannière ───
  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/surveys/${surveyId}/banner`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Échec de l'envoi");
        return;
      }
      patchSettings({
        banner_url: data.banner_url,
        banner_storage_path: data.banner_storage_path,
      });
    } catch {
      setUploadError("Échec de l'envoi");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveBanner() {
    setUploading(true);
    try {
      await fetch(`/api/surveys/${surveyId}/banner`, { method: "DELETE" });
      const next = { ...settings };
      delete next.banner_url;
      delete next.banner_storage_path;
      onChange({ ...schema, settings: next });
    } finally {
      setUploading(false);
    }
  }

  // ─── Géocodage du lieu ───
  async function handleGeocode() {
    const query = [location.name, location.address].filter(Boolean).join(", ");
    if (query.trim().length < 3) {
      setGeoError("Renseignez d'abord le nom ou l'adresse du lieu.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    setGeoResults(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setGeoError(data.error || "Recherche impossible");
        return;
      }
      if (!data.results?.length) {
        setGeoError("Aucun lieu trouvé — précisez l'adresse ou la commune.");
        return;
      }
      setGeoResults(data.results as GeocodeResult[]);
    } catch {
      setGeoError("Recherche impossible");
    } finally {
      setGeocoding(false);
    }
  }

  function pickResult(r: GeocodeResult) {
    patchLocation({ lat: r.lat, lng: r.lng });
    setGeoResults(null);
  }

  const datePreview = event.starts_at ? formatEventDate(event) : null;

  return (
    <section className="edit-section">
      <h3 className="edit-aside-title">Habillage & événement</h3>

      {/* ─── Bannière ─── */}
      <div className="edit-field">
        <label>Visuel bannière</label>
        {settings.banner_url ? (
          <div className="evt-banner-preview">
            <Image
              src={settings.banner_url}
              alt="Bannière du sondage"
              width={640}
              height={214}
              unoptimized
            />
            <button
              type="button"
              className="evt-banner-remove"
              onClick={handleRemoveBanner}
              disabled={uploading}
              title="Retirer la bannière"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="evt-upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <ImagePlus size={16} />
            )}
            {uploading ? "Envoi…" : "Choisir une image"}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
        />
        <p className="edit-field-hint">
          Format bannière — 1200 × 400 px recommandé (ratio 3:1), JPG, PNG ou
          WebP, 5 Mo max. Affichée en tête de l'écran d'accueil du sondage et
          en aperçu lors du partage du lien.
        </p>
        {uploadError && <p className="evt-error">⚠ {uploadError}</p>}
      </div>

      {/* ─── CTA ─── */}
      <div className="edit-field">
        <label>Texte du bouton d'entrée</label>
        <input
          type="text"
          value={settings.start_cta || ""}
          onChange={(e) =>
            patchSettings({ start_cta: e.target.value || undefined })
          }
          placeholder={
            eventOn ? "Je m'inscris" : "Commencer le sondage"
          }
          className="edit-input"
        />
        <p className="edit-field-hint">
          Premier bouton vu par le citoyen. Ex. « Je m'inscris », « Je réserve
          ma place », « Participer ». Par défaut :{" "}
          {eventOn ? "« Je m'inscris »" : "« Commencer le sondage »"}.
        </p>
      </div>

      {/* ─── Mode événement ─── */}
      <div className="edit-field">
        <label className="evt-switch">
          <input
            type="checkbox"
            checked={eventOn}
            onChange={(e) => patchEvent({ enabled: e.target.checked })}
          />
          <span>
            <CalendarDays size={15} /> Mode inscription à un événement
          </span>
        </label>
        <p className="edit-field-hint">
          Affiche la date, le lieu, la carte et l'ajout à l'agenda avant le
          formulaire, puis à nouveau sur l'écran de confirmation.
        </p>
      </div>

      {eventOn && (
        <div className="evt-block">
          <div className="edit-field">
            <label className="evt-switch">
              <input
                type="checkbox"
                checked={Boolean(event.all_day)}
                onChange={(e) => patchEvent({ all_day: e.target.checked })}
              />
              <span>Journée entière</span>
            </label>
          </div>

          <div className="edit-field">
            <label>Début de l'événement *</label>
            <input
              type={event.all_day ? "date" : "datetime-local"}
              value={event.starts_at || ""}
              onChange={(e) =>
                patchEvent({ starts_at: e.target.value || undefined })
              }
              className="edit-input"
            />
          </div>

          <div className="edit-field">
            <label>Fin (facultatif)</label>
            <input
              type={event.all_day ? "date" : "datetime-local"}
              value={event.ends_at || ""}
              onChange={(e) =>
                patchEvent({ ends_at: e.target.value || undefined })
              }
              className="edit-input"
            />
            <p className="edit-field-hint">
              Sans fin renseignée, l'entrée d'agenda dure 2 heures.
            </p>
          </div>

          {datePreview && (
            <p className="evt-preview-line">
              <CalendarDays size={14} /> {datePreview}
            </p>
          )}

          <div className="edit-field">
            <label>Nom du lieu</label>
            <input
              type="text"
              value={location.name || ""}
              onChange={(e) =>
                patchLocation({ name: e.target.value || undefined })
              }
              placeholder="Salle des fêtes"
              className="edit-input"
            />
          </div>

          <div className="edit-field">
            <label>Adresse</label>
            <input
              type="text"
              value={location.address || ""}
              onChange={(e) =>
                patchLocation({ address: e.target.value || undefined })
              }
              placeholder="12 rue de la Mairie, 06740 Châteauneuf"
              className="edit-input"
            />
            <button
              type="button"
              className="evt-geocode-btn"
              onClick={handleGeocode}
              disabled={geocoding}
            >
              {geocoding ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Search size={14} />
              )}
              Localiser sur la carte
            </button>
            <p className="edit-field-hint">
              Nécessaire pour afficher la carte. Sans coordonnées, seul le
              bouton d'itinéraire est proposé.
            </p>
            {geoError && <p className="evt-error">⚠ {geoError}</p>}
            {geoResults && (
              <ul className="evt-geo-results">
                {geoResults.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" onClick={() => pickResult(r)}>
                      <MapPin size={13} /> {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {location.lat != null && location.lng != null && (
            <div className="edit-field">
              <div className="evt-coords">
                <span>
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patchLocation({ lat: undefined, lng: undefined })
                  }
                >
                  Retirer
                </button>
              </div>
              <div className="evt-map-preview">
                <EventMap
                  lat={location.lat}
                  lng={location.lng}
                  label={location.name || location.address}
                  height={160}
                  interactive={false}
                />
              </div>
            </div>
          )}

          <div className="edit-field">
            <label>Précisions (facultatif)</label>
            <input
              type="text"
              value={event.details || ""}
              onChange={(e) =>
                patchEvent({ details: e.target.value || undefined })
              }
              placeholder="Accueil dès 18h, entrée libre"
              className="edit-input"
            />
          </div>

          <div className="edit-field">
            <label>Organisateur (facultatif)</label>
            <input
              type="text"
              value={event.organizer || ""}
              onChange={(e) =>
                patchEvent({ organizer: e.target.value || undefined })
              }
              placeholder="Mairie de Châteauneuf"
              className="edit-input"
            />
          </div>
        </div>
      )}

      <style>{`
        .evt-block {
          border-left: 2px solid #e8e5de;
          padding-left: 14px;
          margin-top: 4px;
        }
        .evt-switch {
          display: flex !important;
          align-items: center;
          gap: 8px;
          text-transform: none !important;
          letter-spacing: 0 !important;
          font-size: 13px !important;
          color: #1a2744 !important;
          cursor: pointer;
        }
        .evt-switch span { display: inline-flex; align-items: center; gap: 6px; }
        .evt-switch input { accent-color: #3b6fa0; width: 16px; height: 16px; }

        .evt-upload-btn, .evt-geocode-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          border: 1.5px dashed #d6d2c8;
          border-radius: 8px;
          background: #fff;
          color: #3b6fa0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.15s;
        }
        .evt-upload-btn { width: 100%; justify-content: center; }
        .evt-geocode-btn { margin-top: 8px; border-style: solid; }
        .evt-upload-btn:hover, .evt-geocode-btn:hover { border-color: #3b6fa0; background: #f6f9fc; }
        .evt-upload-btn:disabled, .evt-geocode-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .evt-banner-preview { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #e8e5de; }
        .evt-banner-preview img { display: block; width: 100%; height: auto; }
        .evt-banner-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 8px;
          background: rgba(255,255,255,0.94);
          color: #c62828;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .evt-banner-remove:hover { background: #fff; }

        .evt-error { font-size: 12px; color: #c62828; margin-top: 6px; }
        .evt-preview-line {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: #3b6fa0;
          background: #f6f9fc;
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 16px;
        }

        .evt-geo-results { list-style: none; margin: 8px 0 0; padding: 0; border: 1px solid #e8e5de; border-radius: 8px; overflow: hidden; }
        .evt-geo-results li + li { border-top: 1px solid #f2efe8; }
        .evt-geo-results button {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border: none;
          background: #fff;
          font-family: inherit;
          font-size: 12px;
          line-height: 1.45;
          color: #1a2744;
          cursor: pointer;
        }
        .evt-geo-results button:hover { background: #f6f9fc; }
        .evt-geo-results svg { flex-shrink: 0; margin-top: 2px; color: #3b6fa0; }

        .evt-coords {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-family: monospace;
          color: #666;
          background: #f7f6f2;
          border-radius: 8px;
          padding: 7px 10px;
        }
        .evt-coords button {
          border: none;
          background: none;
          color: #c62828;
          font-family: inherit;
          font-size: 11px;
          cursor: pointer;
        }
        .evt-map-preview {
          margin-top: 8px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e8e5de;
        }
        .evt-map-preview .leaflet-container { border-radius: 10px; }
      `}</style>
    </section>
  );
}

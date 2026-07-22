"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarDays,
  ImagePlus,
  Loader2,
  MapPin,
  Trash2,
} from "lucide-react";
import type { SurveySchema, SurveyEvent, SurveyEventLocation } from "@/types/survey";
import { formatEventDate } from "@/lib/survey-event";
import EventLocationPicker from "./EventLocationPicker";

// ═══════════════════════════════════════════════════════════════
// EVENT SETTINGS PANEL — back-office
//
// Habillage du sondage (bannière, texte du bouton d'entrée) et, pour
// un événement, sa date et son lieu. Le type — sondage ou événement —
// est choisi à la création : ce panneau ne propose donc pas de
// bascule, il affiche le bloc événement si `settings.event.enabled`.
//
// Tout est stocké dans schema.settings ; seule la bannière transite
// par l'API (upload dans le bucket survey-banners).
// ═══════════════════════════════════════════════════════════════

interface EventSettingsPanelProps {
  surveyId: string;
  schema: SurveySchema;
  onChange: (schema: SurveySchema) => void;
  /** Colonne d'accueil : le titre suit la typographie de la colonne */
  layout?: "aside" | "main";
}

interface GeocodeResult {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

export default function EventSettingsPanel({
  surveyId,
  schema,
  onChange,
  layout = "aside",
}: EventSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const settings = schema.settings || {};
  const event: SurveyEvent = settings.event || {};
  const location: SurveyEventLocation = event.location || {};
  const isEvent = Boolean(event.enabled);

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

  // ─── Contexte commune ───
  // Sert deux fois : il remonte fortement la pertinence des résultats
  // Nominatim, et il centre la carte sur la commune pour que le
  // placement manuel commence au bon endroit (et non sur la France).
  const [communeContext, setCommuneContext] = useState<string>("");
  const [communeCenter, setCommuneCenter] = useState<
    [number, number] | null | undefined
  >(undefined); // undefined = en cours, null = inconnu

  useEffect(() => {
    if (!isEvent) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const me = res.ok ? await res.json() : null;
        if (!alive) return;
        if (!me?.commune?.name) {
          setCommuneCenter(null);
          return;
        }
        const context = [me.commune.code_postal, me.commune.name]
          .filter(Boolean)
          .join(" ");
        setCommuneContext(context);

        const geo = await fetch(`/api/geocode?q=${encodeURIComponent(context)}`);
        const data = geo.ok ? await geo.json() : null;
        if (!alive) return;
        const first = data?.results?.[0];
        setCommuneCenter(first ? [first.lat, first.lng] : null);
      } catch {
        if (alive) setCommuneCenter(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEvent]);

  // ─── Autocomplétion d'adresse ───
  // La saisie pilote la recherche (debounce 450 ms, limite Nominatim
  // 1 req/s) : plus de bouton à cliquer, les suggestions arrivent
  // seules et posent le point sur la carte.
  const [addressQuery, setAddressQuery] = useState(location.address || "");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  // Évite de relancer une recherche sur une valeur qu'on vient d'écrire
  // nous-mêmes (choix d'une suggestion, géocodage inverse).
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (!isEvent) return;
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const q = addressQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      setGeoError(null);
      try {
        const params = new URLSearchParams({ q });
        if (communeContext) params.set("context", communeContext);
        const res = await fetch(`/api/geocode?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setGeoError(data.error || "Recherche impossible");
          return;
        }
        setSuggestions(data.results || []);
      } catch {
        setGeoError("Recherche impossible");
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [addressQuery, communeContext, isEvent]);

  function pickSuggestion(r: GeocodeResult) {
    skipSearchRef.current = true;
    setAddressQuery(r.label);
    setSuggestions([]);
    patchLocation({ address: r.label, lat: r.lat, lng: r.lng });
  }

  // ─── Point posé sur la carte → adresse remplie automatiquement ───
  const handleMapPick = useCallback(
    async (lat: number, lng: number) => {
      patchLocation({ lat, lng });
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
        if (!res.ok) return;
        const data = await res.json();
        const found = data.results?.[0] as GeocodeResult | undefined;
        if (!found) return;
        skipSearchRef.current = true;
        setAddressQuery(found.label);
        setSuggestions([]);
        patchLocation({ lat, lng, address: found.label });
      } catch {
        /* le point reste valide même sans adresse lisible */
      }
    },
    // patchLocation dépend du schema courant, recréé à chaque rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema]
  );

  const datePreview = event.starts_at ? formatEventDate(event) : null;

  return (
    <section className="edit-section">
      {layout === "main" ? (
        <h2 className="edit-section-title">Événement & habillage</h2>
      ) : (
        <h3 className="edit-aside-title">Habillage</h3>
      )}

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
          WebP, 5 Mo max. Affichée en tête de l'écran d'accueil et en aperçu
          lors du partage du lien.
        </p>
        {uploadError && <p className="evt-error">⚠ {uploadError}</p>}
      </div>

      {/* ─── CTA ─── */}
      <div className="edit-field">
        <label>Texte du bouton d&apos;entrée</label>
        <input
          type="text"
          value={settings.start_cta || ""}
          onChange={(e) =>
            patchSettings({ start_cta: e.target.value || undefined })
          }
          placeholder={isEvent ? "Je m'inscris" : "Commencer le sondage"}
          className="edit-input"
        />
        <p className="edit-field-hint">
          Premier bouton vu par le citoyen. Par défaut :{" "}
          {isEvent ? "« Je m'inscris »" : "« Commencer le sondage »"}.
        </p>
      </div>

      {isEvent && (
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
            <label>Début de l&apos;événement *</label>
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
              Sans fin renseignée, l&apos;entrée d&apos;agenda dure 2 heures.
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
            <p className="edit-field-hint">
              Affiché en gras au-dessus de l&apos;adresse.
            </p>
          </div>

          <div className="edit-field evt-address-field">
            <label>Adresse</label>
            <div className="evt-address-input">
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value);
                  patchLocation({ address: e.target.value || undefined });
                }}
                placeholder="Commencez à taper : 12 rue de la Mairie…"
                className="edit-input"
                autoComplete="off"
              />
              {searching && (
                <Loader2 size={15} className="spin evt-address-spinner" />
              )}
            </div>

            {suggestions.length > 0 && (
              <ul className="evt-geo-results">
                {suggestions.map((r) => (
                  <li key={`${r.lat},${r.lng}`}>
                    <button type="button" onClick={() => pickSuggestion(r)}>
                      <MapPin size={13} />
                      <span>
                        <strong>{r.label}</strong>
                        <em>{r.detail}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="edit-field-hint">
              Les suggestions apparaissent au fil de la saisie. Rien ne
              correspond ? Placez simplement le point sur la carte : l&apos;adresse
              se remplit toute seule.
            </p>
            {geoError && <p className="evt-error">⚠ {geoError}</p>}
          </div>

          <div className="edit-field">
            <label>Point exact sur la carte</label>
            {location.lat != null || communeCenter !== undefined ? (
              <EventLocationPicker
                lat={location.lat}
                lng={location.lng}
                onChange={handleMapPick}
                defaultCenter={communeCenter ?? undefined}
                defaultZoom={communeCenter ? 14 : 5}
                height={240}
              />
            ) : (
              <div className="evt-map-loading">
                <Loader2 size={16} className="spin" /> Centrage sur la commune…
              </div>
            )}
            {location.lat != null && location.lng != null ? (
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
                  Retirer le point
                </button>
              </div>
            ) : (
              <p className="edit-field-hint">
                Cliquez sur la carte pour placer le lieu, puis glissez le
                curseur pour l&apos;ajuster au mètre près.
              </p>
            )}
          </div>

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

        .evt-upload-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
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
        .evt-upload-btn:hover { border-color: #3b6fa0; background: #f6f9fc; }
        .evt-upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }

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

        /* ─── Adresse : champ + suggestions ─── */
        .evt-address-field { position: relative; }
        .evt-address-input { position: relative; }
        .evt-address-spinner {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #3b6fa0;
          pointer-events: none;
        }
        .evt-geo-results {
          list-style: none;
          margin: 6px 0 0;
          padding: 0;
          border: 1px solid #e8e5de;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 6px 20px rgba(0,0,0,0.08);
          max-height: 260px;
          overflow-y: auto;
        }
        .evt-geo-results li + li { border-top: 1px solid #f2efe8; }
        .evt-geo-results button {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          text-align: left;
          padding: 9px 11px;
          border: none;
          background: #fff;
          font-family: inherit;
          cursor: pointer;
        }
        .evt-geo-results button:hover { background: #f6f9fc; }
        .evt-geo-results svg { flex-shrink: 0; margin-top: 3px; color: #3b6fa0; }
        .evt-geo-results strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #1a2744;
          line-height: 1.4;
        }
        .evt-geo-results em {
          display: block;
          font-size: 11px;
          font-style: normal;
          color: #999;
          line-height: 1.4;
          margin-top: 1px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .evt-map-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 240px;
          border: 1px solid #e8e5de;
          border-radius: 10px;
          background: #f7f6f2;
          font-size: 13px;
          color: #888;
        }
        .evt-coords {
          margin-top: 8px;
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
      `}</style>
    </section>
  );
}

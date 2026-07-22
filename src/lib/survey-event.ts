import type { SurveyEvent, SurveyEventLocation } from "@/types/survey";

// ═══════════════════════════════════════════════════════════════
// SURVEY EVENT — helpers agenda + cartographie
//
// Le mode événement d'un sondage (schema.settings.event) sert de
// formulaire d'inscription. On génère ici les liens agenda (ICS
// universel + Google/Outlook) et les liens cartographiques.
// Aucune clé d'API : Google Maps en lien externe, OpenStreetMap
// pour l'aperçu embarqué.
// ═══════════════════════════════════════════════════════════════

export function eventIsConfigured(event?: SurveyEvent | null): event is SurveyEvent {
  return Boolean(event?.enabled && event.starts_at);
}

export function locationLabel(loc?: SurveyEventLocation | null): string {
  if (!loc) return "";
  return [loc.name, loc.address].filter(Boolean).join(", ");
}

export function hasLocation(loc?: SurveyEventLocation | null): boolean {
  return Boolean(loc && (loc.address || loc.name || (loc.lat != null && loc.lng != null)));
}

/** Cible d'itinéraire : coordonnées si connues, sinon libellé texte. */
function mapTarget(loc?: SurveyEventLocation | null): string | null {
  if (!loc) return null;
  if (loc.lat != null && loc.lng != null) return `${loc.lat},${loc.lng}`;
  const label = locationLabel(loc);
  return label || null;
}

/** Lien « Itinéraire » Google Maps (ouvre l'app native sur mobile). */
export function directionsUrl(loc?: SurveyEventLocation | null): string | null {
  const target = mapTarget(loc);
  if (!target) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}

/** Lien « Voir sur la carte ». */
export function mapUrl(loc?: SurveyEventLocation | null): string | null {
  const target = mapTarget(loc);
  if (!target) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
}

// ─── Dates ───

/**
 * Les dates saisies au back-office proviennent d'un `datetime-local`
 * (« 2026-09-12T18:30 », sans fuseau) : on les interprète dans le
 * fuseau du navigateur, ce qui correspond au fuseau de la commune.
 */
export function parseEventDate(value?: string | null): Date | null {
  if (!value) return null;
  // « 2026-09-12 » seul serait interprété en UTC par le moteur JS :
  // on force l'interprétation locale pour ne pas décaler d'un jour.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fin de l'événement, avec repli à +2 h (ou +1 jour si journée entière). */
export function eventEnd(event: SurveyEvent): Date | null {
  const start = parseEventDate(event.starts_at);
  if (!start) return null;
  const end = parseEventDate(event.ends_at);
  if (end && end > start) return end;
  return new Date(start.getTime() + (event.all_day ? 24 : 2) * 3600_000);
}

/** « Samedi 12 septembre 2026, 18:30 – 22:00 » */
export function formatEventDate(event: SurveyEvent): string {
  const start = parseEventDate(event.starts_at);
  if (!start) return "";

  const day = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (event.all_day) return day.charAt(0).toUpperCase() + day.slice(1);

  const time = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const end = parseEventDate(event.ends_at);
  const sameDay = end && end.toDateString() === start.toDateString();
  const label =
    end && sameDay
      ? `${day}, ${time(start)} – ${time(end)}`
      : end
      ? `${day}, ${time(start)} → ${end.toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
        })}, ${time(end)}`
      : `${day}, ${time(start)}`;

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function eventIsPast(event: SurveyEvent): boolean {
  const end = eventEnd(event);
  return Boolean(end && end.getTime() < Date.now());
}

// ─── Agenda ───

/** YYYYMMDDTHHMMSSZ */
function toUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** YYYYMMDD (journée entière) */
function toDateStamp(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Échappement RFC 5545 des valeurs texte. */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Pliage des lignes à 75 octets (RFC 5545). */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export interface CalendarPayload {
  title: string;
  description?: string;
  url?: string;
}

/** Contenu d'un fichier .ics pour l'événement (Apple, Outlook, tout agenda). */
export function buildIcs(event: SurveyEvent, payload: CalendarPayload): string | null {
  const start = parseEventDate(event.starts_at);
  const end = eventEnd(event);
  if (!start || !end) return null;

  const dtStart = event.all_day
    ? `DTSTART;VALUE=DATE:${toDateStamp(start)}`
    : `DTSTART:${toUtcStamp(start)}`;
  const dtEnd = event.all_day
    ? `DTEND;VALUE=DATE:${toDateStamp(end)}`
    : `DTEND:${toUtcStamp(end)}`;

  const description = [payload.description, event.details, payload.url]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoCiviq//Sondages//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@gociviq`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcs(payload.title)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  const loc = locationLabel(event.location);
  if (loc) lines.push(`LOCATION:${escapeIcs(loc)}`);
  if (event.organizer) lines.push(`ORGANIZER;CN=${escapeIcs(event.organizer)}:MAILTO:noreply@gociviq.fr`);
  if (payload.url) lines.push(`URL:${escapeIcs(payload.url)}`);
  if (event.location?.lat != null && event.location?.lng != null) {
    lines.push(`GEO:${event.location.lat};${event.location.lng}`);
  }

  lines.push("BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Rappel", "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n");
}

/** Déclenche le téléchargement du .ics (client uniquement). */
export function downloadIcs(
  event: SurveyEvent,
  payload: CalendarPayload,
  filename = "evenement.ics"
): boolean {
  const ics = buildIcs(event, payload);
  if (!ics || typeof window === "undefined") return false;

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function googleCalendarUrl(
  event: SurveyEvent,
  payload: CalendarPayload
): string | null {
  const start = parseEventDate(event.starts_at);
  const end = eventEnd(event);
  if (!start || !end) return null;

  const dates = event.all_day
    ? `${toDateStamp(start)}/${toDateStamp(end)}`
    : `${toUtcStamp(start)}/${toUtcStamp(end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: payload.title,
    dates,
  });
  const details = [payload.description, event.details, payload.url]
    .filter(Boolean)
    .join("\n\n");
  if (details) params.set("details", details);
  const loc = locationLabel(event.location);
  if (loc) params.set("location", loc);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(
  event: SurveyEvent,
  payload: CalendarPayload
): string | null {
  const start = parseEventDate(event.starts_at);
  const end = eventEnd(event);
  if (!start || !end) return null;

  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: payload.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (event.all_day) params.set("allday", "true");
  const details = [payload.description, event.details, payload.url]
    .filter(Boolean)
    .join("\n\n");
  if (details) params.set("body", details);
  const loc = locationLabel(event.location);
  if (loc) params.set("location", loc);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

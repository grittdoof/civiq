// ═══════════════════════════════════════════════════════════════
// Convocations de séance — helpers purs (dates, agenda, texte)
//
// CONVENTION DE DATE : `commission_sessions.date_seance` est saisi en
// `datetime-local` (« 2026-10-01T18:30 », sans fuseau) puis stocké en
// timestamptz par Postgres (fuseau de session UTC). La valeur stockée
// porte donc l'HEURE MURALE de la commune dans ses composantes UTC
// (18:30 saisi → 18:30Z). Tout l'affichage serveur existant repose
// sur cette convention (Vercel tourne en UTC) : on la respecte ici en
// lisant les composantes UTC et en les publiant dans le fuseau
// Europe/Paris pour les agendas.
// ═══════════════════════════════════════════════════════════════

import { randomBytes } from "crypto";

export const SESSION_TIMEZONE = "Europe/Paris";
export const DEFAULT_SESSION_DURATION_MIN = 120;

export interface SessionCalendarInput {
  /** Identifiant stable de la séance (UID de l'événement agenda) */
  sessionId: string;
  title: string;
  /** date_seance brute (ISO) */
  dateSeance: string;
  durationMinutes?: number;
  location?: string | null;
  /** Texte brut (ordre du jour déjà converti) */
  description?: string | null;
  url?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
}

// ─── Dates ───

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date murale (composantes UTC) → « 20261001T183000 » */
function wallStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}00`;
}

/** Date murale → « 2026-10-01T18:30:00 » (sans fuseau) */
function wallIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:00`;
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function sessionStart(dateSeance: string): Date | null {
  const d = new Date(dateSeance);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sessionEnd(dateSeance: string, durationMinutes = DEFAULT_SESSION_DURATION_MIN): Date | null {
  const start = sessionStart(dateSeance);
  if (!start) return null;
  return new Date(start.getTime() + durationMinutes * 60_000);
}

/** « Jeudi 1 octobre 2026 à 18h30 » */
export function formatSessionDate(dateSeance: string): string {
  const d = sessionStart(dateSeance);
  if (!d) return "";
  const day = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const label = `${day} à ${d.getUTCHours()}h${pad(d.getUTCMinutes())}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ─── Texte ───

/** Convertit l'ordre du jour (HTML assaini) en texte brut lisible. */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Jeton de réponse ───

/** Jeton opaque, non devinable (192 bits), sûr en URL. */
export function generateConvocationToken(): string {
  return randomBytes(24).toString("base64url");
}

// ─── Agenda ───

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Pliage des lignes à 75 caractères (RFC 5545). */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function fullDescription(input: SessionCalendarInput): string {
  return [input.description, input.url ? `Répondre / détails : ${input.url}` : null]
    .filter(Boolean)
    .join("\n\n");
}

// Définition Europe/Paris embarquée : Outlook desktop l'exige pour
// interpréter un TZID ; Apple et Google la tolèrent.
const VTIMEZONE_PARIS = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Fichier .ics (Apple Calendrier, Outlook desktop, tout agenda). */
export function buildSessionIcs(input: SessionCalendarInput): string | null {
  const start = sessionStart(input.dateSeance);
  const end = sessionEnd(input.dateSeance, input.durationMinutes);
  if (!start || !end) return null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoCiviq//Commissions//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_PARIS,
    "BEGIN:VEVENT",
    // UID stable : réimporter la convocation met à jour l'événement
    // au lieu de le dupliquer.
    `UID:commission-session-${input.sessionId}@gociviq.fr`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART;TZID=${SESSION_TIMEZONE}:${wallStamp(start)}`,
    `DTEND;TZID=${SESSION_TIMEZONE}:${wallStamp(end)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
  ];
  const description = fullDescription(input);
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (input.location) lines.push(`LOCATION:${escapeIcs(input.location)}`);
  if (input.url) lines.push(`URL:${escapeIcs(input.url)}`);
  if (input.organizerName || input.organizerEmail) {
    const cn = input.organizerName ? `;CN=${escapeIcs(input.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:MAILTO:${input.organizerEmail || "noreply@gociviq.fr"}`);
  }
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rappel",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldIcsLine).join("\r\n");
}

export function googleCalendarUrl(input: SessionCalendarInput): string | null {
  const start = sessionStart(input.dateSeance);
  const end = sessionEnd(input.dateSeance, input.durationMinutes);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    // Heure murale + ctz : Google convertit depuis Europe/Paris
    dates: `${wallStamp(start)}/${wallStamp(end)}`,
    ctz: SESSION_TIMEZONE,
  });
  const details = fullDescription(input);
  if (details) params.set("details", details);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook (Microsoft 365 — cas le plus courant en mairie). */
export function outlookCalendarUrl(input: SessionCalendarInput): string | null {
  const start = sessionStart(input.dateSeance);
  const end = sessionEnd(input.dateSeance, input.durationMinutes);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: input.title,
    // Sans fuseau : Outlook interprète dans le fuseau du compte
    startdt: wallIso(start),
    enddt: wallIso(end),
  });
  const details = fullDescription(input);
  if (details) params.set("body", details);
  if (input.location) params.set("location", input.location);
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

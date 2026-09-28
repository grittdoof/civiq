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
import { escapeIcs, foldIcsLine, utcStamp, VTIMEZONE_PARIS, wallIso, wallStamp } from "@/lib/calendar/ics";

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

function fullDescription(input: SessionCalendarInput): string {
  return [input.description, input.url ? `Répondre / détails : ${input.url}` : null]
    .filter(Boolean)
    .join("\n\n");
}

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

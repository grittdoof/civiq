// ═══════════════════════════════════════════════════════════════
// Primitives iCalendar (RFC 5545) partagées : échappement, pliage,
// fuseau Europe/Paris, construction d'un VCALENDAR.
//
// Convention GoCiviq (Session 16) : les dates « murales » (séances,
// étapes, événements) sont stockées dans les composantes UTC. On les
// publie donc en TZID=Europe/Paris en lisant ces composantes, sans
// conversion de fuseau.
// ═══════════════════════════════════════════════════════════════

export const TZ_PARIS = "Europe/Paris";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date murale (composantes UTC) → « 20261001T183000 » */
export function wallStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

/** Date murale → « 2026-10-01T18:30:00 » (sans fuseau) */
export function wallIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

/** Jour (composantes UTC) → « 20261001 » */
export function dayStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Instant réel → « 20261001T163000Z » (DTSTAMP) */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Pliage des lignes à 75 caractères (RFC 5545). */
export function foldIcsLine(line: string): string {
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

// Définition Europe/Paris embarquée : Outlook desktop l'exige pour
// interpréter un TZID ; Apple et Google la tolèrent.
export const VTIMEZONE_PARIS = [
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

export interface IcsEvent {
  uid: string;
  /** Date murale ISO (composantes UTC). */
  start: string;
  /** Date murale ISO de fin ; défaut : +1 h (ou +1 jour si journée entière). */
  end?: string | null;
  allDay: boolean;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  categories?: string[];
  /** Horodatage de dernière modification (instant réel). */
  lastModified?: string | null;
}

const DAY = 86_400_000;

function eventLines(e: IcsEvent, now: Date): string[] | null {
  const start = new Date(e.start);
  if (Number.isNaN(start.getTime())) return null;
  const endRaw = e.end ? new Date(e.end) : null;
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(now)}`];
  if (e.allDay) {
    // DTEND exclusif : le lendemain du dernier jour.
    const last = endRaw && !Number.isNaN(endRaw.getTime()) && endRaw > start ? endRaw : start;
    lines.push(`DTSTART;VALUE=DATE:${dayStamp(start)}`, `DTEND;VALUE=DATE:${dayStamp(new Date(last.getTime() + DAY))}`);
  } else {
    const end = endRaw && !Number.isNaN(endRaw.getTime()) && endRaw > start ? endRaw : new Date(start.getTime() + 3_600_000);
    lines.push(`DTSTART;TZID=${TZ_PARIS}:${wallStamp(start)}`, `DTEND;TZID=${TZ_PARIS}:${wallStamp(end)}`);
  }
  lines.push(`SUMMARY:${escapeIcs(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
  if (e.url) lines.push(`URL:${escapeIcs(e.url)}`);
  if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(escapeIcs).join(",")}`);
  if (e.lastModified) {
    const lm = new Date(e.lastModified);
    if (!Number.isNaN(lm.getTime())) lines.push(`LAST-MODIFIED:${utcStamp(lm)}`);
  }
  lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  return lines;
}

/**
 * Agenda complet pour un abonnement (flux iCal). Les agendas relisent
 * l'URL à leur rythme ; REFRESH-INTERVAL n'est qu'une indication.
 */
export function buildIcsCalendar(
  events: IcsEvent[],
  opts: { name: string; description?: string; prodId?: string; now?: Date },
): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId ?? "-//GoCiviq//Calendrier//FR"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(opts.name)}`,
    `X-WR-TIMEZONE:${TZ_PARIS}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
  ];
  if (opts.description) lines.push(`X-WR-CALDESC:${escapeIcs(opts.description)}`);
  lines.push(...VTIMEZONE_PARIS);
  for (const e of events) {
    const l = eventLines(e, now);
    if (l) lines.push(...l);
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

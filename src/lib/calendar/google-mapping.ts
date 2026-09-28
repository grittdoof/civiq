// Correspondance calendrier GoCiviq → événement Google Agenda (serveur).
import { createHash } from "crypto";
import { TZ_PARIS, wallIso } from "@/lib/calendar/ics";
import { DAY, descriptionAgenda, titreAgenda, type CalendarEvent } from "@/lib/projects/calendar";

/**
 * Identifiant d'événement Google déterministe (base32hex autorisé :
 * 0-9 a-v ; l'hexadécimal en est un sous-ensemble). Réinsérer un
 * événement déjà présent renvoie 409 au lieu de créer un doublon.
 */
export function idGoogle(cle: string, profileId: string): string {
  return `gc${createHash("sha256").update(`${profileId}|${cle}`).digest("hex").slice(0, 40)}`;
}

export interface GoogleEventResource {
  id: string;
  summary: string;
  description: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
  source: { title: string; url: string };
  transparency: "transparent";
  status: "confirmed";
}

export function versGoogle(e: CalendarEvent, profileId: string, siteUrl: string): GoogleEventResource {
  const debut = new Date(e.date);
  let start: GoogleEventResource["start"];
  let end: GoogleEventResource["end"];
  if (e.allDay) {
    const fin = e.fin ? new Date(e.fin) : debut;
    start = { date: e.date.slice(0, 10) };
    end = { date: new Date((fin > debut ? fin : debut).getTime() + DAY).toISOString().slice(0, 10) };
  } else {
    const fin = e.fin && new Date(e.fin) > debut ? new Date(e.fin) : new Date(debut.getTime() + 3_600_000);
    start = { dateTime: wallIso(debut), timeZone: TZ_PARIS };
    end = { dateTime: wallIso(fin), timeZone: TZ_PARIS };
  }
  return {
    id: idGoogle(e.id, profileId),
    summary: titreAgenda(e),
    description: descriptionAgenda(e, siteUrl),
    ...(e.lieu ? { location: e.lieu } : {}),
    start,
    end,
    source: { title: "GoCiviq", url: `${siteUrl}${e.href}` },
    transparency: "transparent",
    status: "confirmed",
  };
}

export function empreinte(r: GoogleEventResource): string {
  return createHash("sha256").update(JSON.stringify(r)).digest("hex").slice(0, 32);
}


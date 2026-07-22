import { describe, it, expect } from "vitest";
import {
  buildIcs,
  directionsUrl,
  eventEnd,
  eventIsConfigured,
  eventIsPast,
  formatEventDate,
  googleCalendarUrl,
  hasLocation,
  locationLabel,
  mapUrl,
  outlookCalendarUrl,
  parseEventDate,
} from "@/lib/survey-event";
import type { SurveyEvent } from "@/types/survey";

const BASE: SurveyEvent = {
  enabled: true,
  starts_at: "2026-09-12T18:30",
  ends_at: "2026-09-12T22:00",
  details: "Accueil dès 18h",
  organizer: "Mairie de Châteauneuf",
  location: {
    name: "Salle des fêtes",
    address: "Place Georges Font, 06740 Châteauneuf",
    lat: 43.6787,
    lng: 6.9974,
  },
};

const PAYLOAD = {
  title: "Fête des associations",
  description: "Venez rencontrer les associations de la commune",
  url: "https://www.gociviq.fr/survey/fete-des-associations",
};

describe("eventIsConfigured", () => {
  it("exige le flag activé ET une date de début", () => {
    expect(eventIsConfigured(BASE)).toBe(true);
    expect(eventIsConfigured({ ...BASE, enabled: false })).toBe(false);
    expect(eventIsConfigured({ enabled: true })).toBe(false);
    expect(eventIsConfigured(undefined)).toBe(false);
  });
});

describe("parseEventDate", () => {
  it("interprète une date seule en heure locale (pas en UTC)", () => {
    const d = parseEventDate("2026-09-12")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it("parse un datetime-local", () => {
    const d = parseEventDate("2026-09-12T18:30")!;
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });

  it("retourne null sur une valeur vide ou invalide", () => {
    expect(parseEventDate(undefined)).toBeNull();
    expect(parseEventDate("")).toBeNull();
    expect(parseEventDate("pas-une-date")).toBeNull();
  });
});

describe("eventEnd", () => {
  it("utilise la fin renseignée", () => {
    expect(eventEnd(BASE)?.getHours()).toBe(22);
  });

  it("retombe sur +2 h sans fin renseignée", () => {
    const end = eventEnd({ ...BASE, ends_at: undefined })!;
    expect(end.getHours()).toBe(20);
    expect(end.getMinutes()).toBe(30);
  });

  it("retombe sur +1 jour pour une journée entière", () => {
    const end = eventEnd({
      enabled: true,
      all_day: true,
      starts_at: "2026-09-12",
    })!;
    expect(end.getDate()).toBe(13);
  });

  it("ignore une fin antérieure au début", () => {
    const end = eventEnd({ ...BASE, ends_at: "2026-09-12T09:00" })!;
    expect(end.getHours()).toBe(20);
  });
});

describe("formatEventDate", () => {
  it("affiche jour + plage horaire", () => {
    expect(formatEventDate(BASE)).toBe("Samedi 12 septembre 2026, 18:30 – 22:00");
  });

  it("omet l'heure sur une journée entière", () => {
    expect(
      formatEventDate({ enabled: true, all_day: true, starts_at: "2026-09-12" })
    ).toBe("Samedi 12 septembre 2026");
  });

  it("affiche la date de fin si l'événement déborde sur un autre jour", () => {
    const label = formatEventDate({ ...BASE, ends_at: "2026-09-13T02:00" });
    expect(label).toContain("→");
    expect(label).toContain("13 septembre");
  });

  it("retourne une chaîne vide sans date de début", () => {
    expect(formatEventDate({ enabled: true })).toBe("");
  });
});

describe("eventIsPast", () => {
  it("détecte un événement terminé", () => {
    expect(eventIsPast({ enabled: true, starts_at: "2020-01-01T10:00" })).toBe(true);
    expect(eventIsPast({ enabled: true, starts_at: "2099-01-01T10:00" })).toBe(false);
  });
});

describe("lieu et cartes", () => {
  it("compose le libellé du lieu", () => {
    expect(locationLabel(BASE.location)).toBe(
      "Salle des fêtes, Place Georges Font, 06740 Châteauneuf"
    );
    expect(locationLabel(undefined)).toBe("");
  });

  it("détecte un lieu exploitable", () => {
    expect(hasLocation(BASE.location)).toBe(true);
    expect(hasLocation({})).toBe(false);
    expect(hasLocation({ address: "3 rue du Four" })).toBe(true);
  });

  it("privilégie les coordonnées pour l'itinéraire", () => {
    expect(directionsUrl(BASE.location)).toContain("destination=43.6787%2C6.9974");
  });

  it("retombe sur l'adresse texte sans coordonnées", () => {
    const url = mapUrl({ address: "3 rue du Four, Grasse" })!;
    expect(url).toContain("query=3%20rue%20du%20Four%2C%20Grasse");
  });

  it("ne produit aucun lien sans lieu", () => {
    expect(directionsUrl({})).toBeNull();
    expect(mapUrl(undefined)).toBeNull();
  });
});

describe("buildIcs", () => {
  it("génère un VEVENT complet", () => {
    const ics = buildIcs(BASE, PAYLOAD)!;
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Fête des associations");
    expect(ics).toContain("GEO:43.6787;6.9974");
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toMatch(/DTEND:\d{8}T\d{6}Z/);
  });

  it("utilise des dates sans heure pour une journée entière", () => {
    const ics = buildIcs(
      { enabled: true, all_day: true, starts_at: "2026-09-12" },
      PAYLOAD
    )!;
    expect(ics).toContain("DTSTART;VALUE=DATE:20260912");
    expect(ics).toContain("DTEND;VALUE=DATE:20260913");
  });

  it("échappe les virgules et points-virgules (RFC 5545)", () => {
    const ics = buildIcs(BASE, { title: "Repas, jeux; danse" })!;
    expect(ics).toContain("SUMMARY:Repas\\, jeux\\; danse");
  });

  it("plie les lignes trop longues à 75 caractères", () => {
    const ics = buildIcs(BASE, { title: "A".repeat(200) })!;
    const tooLong = ics.split("\r\n").filter((l) => l.length > 75);
    expect(tooLong).toHaveLength(0);
  });

  it("retourne null sans date de début", () => {
    expect(buildIcs({ enabled: true }, PAYLOAD)).toBeNull();
  });
});

describe("liens agenda web", () => {
  it("génère l'URL Google Agenda", () => {
    const url = googleCalendarUrl(BASE, PAYLOAD)!;
    expect(url).toContain("calendar.google.com");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toMatch(/dates=\d{8}T\d{6}Z%2F\d{8}T\d{6}Z/);
    expect(url).toContain("location=Salle+des+f");
  });

  it("génère l'URL Outlook", () => {
    const url = outlookCalendarUrl(BASE, PAYLOAD)!;
    expect(url).toContain("outlook.live.com");
    expect(url).toContain("rru=addevent");
  });

  it("retourne null sans date", () => {
    expect(googleCalendarUrl({ enabled: true }, PAYLOAD)).toBeNull();
    expect(outlookCalendarUrl({ enabled: true }, PAYLOAD)).toBeNull();
  });
});

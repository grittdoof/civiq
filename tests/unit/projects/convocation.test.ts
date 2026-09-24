import { describe, it, expect } from "vitest";
import {
  buildSessionIcs,
  formatSessionDate,
  generateConvocationToken,
  googleCalendarUrl,
  outlookCalendarUrl,
  richTextToPlain,
  sessionEnd,
} from "@/lib/projects/convocation";
import { buildConvocationEmail } from "@/lib/emails/commission-convocation";

// date_seance : heure murale stockée dans les composantes UTC
// (saisie datetime-local « 2026-10-01T18:30 » → 18:30Z en base)
const DATE = "2026-10-01T18:30:00+00:00";

const input = {
  sessionId: "abc-123",
  title: "Commission Urbanisme",
  dateSeance: DATE,
  location: "Salle du conseil, 1 place de la Mairie",
  description: "Ordre du jour :\n• PLU; révision",
  url: "https://www.gociviq.fr/convocation/tok",
  organizerName: "Mairie de Châteauneuf",
  organizerEmail: "mairie@chateauneuf.fr",
};

describe("formatSessionDate", () => {
  it("affiche l'heure murale saisie, quel que soit le fuseau du serveur", () => {
    expect(formatSessionDate(DATE)).toBe("Jeudi 1 octobre 2026 à 18h30");
  });
  it("renvoie une chaîne vide pour une date invalide", () => {
    expect(formatSessionDate("pas-une-date")).toBe("");
  });
});

describe("sessionEnd", () => {
  it("ajoute 2 h par défaut", () => {
    expect(sessionEnd(DATE)?.toISOString()).toBe("2026-10-01T20:30:00.000Z");
  });
});

describe("buildSessionIcs", () => {
  const ics = buildSessionIcs(input)!;
  // Déplie les lignes (RFC 5545 §3.1) avant de chercher du contenu
  const unfolded = ics.replace(/\r\n /g, "");
  it("publie l'heure murale en Europe/Paris avec VTIMEZONE", () => {
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261001T183000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20261001T203000");
    expect(ics).toContain("BEGIN:VTIMEZONE");
  });
  it("utilise un UID stable par séance (réimport = mise à jour)", () => {
    expect(ics).toContain("UID:commission-session-abc-123@gociviq.fr");
  });
  it("échappe les caractères spéciaux RFC 5545", () => {
    expect(unfolded).toContain("PLU\\; révision");
    expect(unfolded).toContain("LOCATION:Salle du conseil\\, 1 place de la Mairie");
  });
  it("utilise des fins de ligne CRLF et plie à 75 caractères", () => {
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
  it("renvoie null pour une date invalide", () => {
    expect(buildSessionIcs({ ...input, dateSeance: "x" })).toBeNull();
  });
});

describe("liens agenda", () => {
  it("Google : heure murale + ctz Europe/Paris", () => {
    const url = new URL(googleCalendarUrl(input)!);
    expect(url.searchParams.get("dates")).toBe("20261001T183000/20261001T203000");
    expect(url.searchParams.get("ctz")).toBe("Europe/Paris");
    expect(url.searchParams.get("text")).toBe("Commission Urbanisme");
  });
  it("Outlook : dates sans fuseau", () => {
    const url = new URL(outlookCalendarUrl(input)!);
    expect(url.searchParams.get("startdt")).toBe("2026-10-01T18:30:00");
    expect(url.searchParams.get("enddt")).toBe("2026-10-01T20:30:00");
  });
});

describe("richTextToPlain", () => {
  it("convertit listes et paragraphes", () => {
    expect(richTextToPlain("<p>Points :</p><ul><li>PLU</li><li>Voirie &amp; réseaux</li></ul>"))
      .toBe("Points :\n\n• PLU\n\n• Voirie & réseaux");
  });
  it("gère null", () => {
    expect(richTextToPlain(null)).toBe("");
  });
});

describe("generateConvocationToken", () => {
  it("produit des jetons URL-safe, longs et uniques", () => {
    const a = generateConvocationToken();
    const b = generateConvocationToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("buildConvocationEmail", () => {
  const base = {
    siteUrl: "https://www.gociviq.fr",
    commune: {
      name: "Châteauneuf",
      logo_url: "https://cdn.example/logo.png",
      address: "1 place de la Mairie",
      code_postal: "06740",
      phone: "04 93 00 00 00",
      contact_email: "mairie@chateauneuf.fr",
    },
    commissionName: "Urbanisme",
    recipientName: "Jeanne <script>",
    dateLabel: "Jeudi 1 octobre 2026 à 18h30",
    lieu: "Salle du conseil",
    ordreDuJourHtml: "<ul><li>PLU</li></ul>",
    acceptUrl: "https://www.gociviq.fr/convocation/t?reponse=present",
    declineUrl: "https://www.gociviq.fr/convocation/t?reponse=absent",
    icsUrl: "https://www.gociviq.fr/api/convocations/t/ics",
    googleUrl: "https://calendar.google.com/x",
    outlookUrl: "https://outlook.office.com/x",
  };
  const { html, subject, text } = buildConvocationEmail(base);

  it("contient logo commune, ordre du jour, adresse mairie et logo GoCiviq", () => {
    expect(html).toContain("https://cdn.example/logo.png");
    expect(html).toContain("<ul><li>PLU</li></ul>");
    expect(html).toContain("1 place de la Mairie");
    expect(html).toContain("06740 Châteauneuf");
    expect(html).toContain("/brand/logo-horizontal.png");
  });
  it("contient les réponses et les 3 agendas", () => {
    expect(html).toContain("reponse=present");
    expect(html).toContain("reponse=absent");
    expect(html).toContain("/api/convocations/t/ics");
    expect(html).toContain("calendar.google.com");
    expect(html).toContain("outlook.office.com");
  });
  it("échappe le nom du destinataire", () => {
    expect(html).toContain("Jeanne &lt;script&gt;");
    expect(html).not.toContain("Jeanne <script>");
  });
  it("sujet et version texte", () => {
    expect(subject).toBe("Convocation : Urbanisme — Jeudi 1 octobre 2026 à 18h30");
    expect(text).toContain("Je serai présent·e : https://www.gociviq.fr/convocation/t?reponse=present");
  });
  it("repli sur le nom de la commune sans logo", () => {
    const r = buildConvocationEmail({ ...base, commune: { name: "Châteauneuf" } });
    expect(r.html).toContain("🏛️ Châteauneuf");
  });
});

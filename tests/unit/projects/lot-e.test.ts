import { describe, expect, it, beforeAll } from "vitest";
import {
  construireEvenements,
  dansFenetreExterne,
  estJourneeEntiere,
  filtrerEvenements,
  libelleCategorie,
  lienAbonnementGoogle,
  lienWebcal,
  registreVisuel,
  restreindreAuProfil,
  texteAccessible,
  versIcs,
  type CalendarRaw,
} from "@/lib/projects/calendar";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { empreinte, idGoogle, versGoogle } from "@/lib/calendar/google-mapping";

const NOW = new Date("2026-10-15T09:00:00Z");
const ME = "u-me";

function raw(): CalendarRaw {
  return {
    projects: [
      { id: "p1", titre: "Réfection de l'église", type_code: "investissement", commission_pilote_id: "c1", pilote_elu: ME, pilote_agent: null, evenement_debut: null, evenement_fin: null, lieu: null, date_maj: null },
      { id: "p2", titre: "Fête de la musique", type_code: "evenementiel", commission_pilote_id: "c2", pilote_elu: "u-other", pilote_agent: null, evenement_debut: "2027-06-21T18:00:00.000Z", evenement_fin: "2027-06-21T23:30:00.000Z", lieu: "Place de la mairie", date_maj: null },
      { id: "p3", titre: "Unicef", type_code: "suivi_simple", commission_pilote_id: null, pilote_elu: "u-other", pilote_agent: null, evenement_debut: null, evenement_fin: null, lieu: null, date_maj: null },
    ],
    milestones: [
      // En retard : prévue avant aujourd'hui, pas terminée
      { id: "m1", project_id: "p1", libelle: "Dépôt DETR", statut: "a_faire", fait: false, echeance: null, date_previsionnelle: "2026-10-01T00:00:00.000Z", date_reelle: null, est_un_jalon: true, responsable_user_id: null, updated_at: null },
      // Terminée : date réelle retenue, date prévue gardée pour info
      { id: "m2", project_id: "p1", libelle: "Choix de l'architecte", statut: "termine", fait: true, echeance: null, date_previsionnelle: "2026-09-01T00:00:00.000Z", date_reelle: "2026-09-10T00:00:00.000Z", est_un_jalon: false, responsable_user_id: null, updated_at: null },
      // Étape d'un projet d'un autre, dont je suis responsable
      { id: "m3", project_id: "p3", libelle: "Relancer le partenaire", statut: "en_cours", fait: false, echeance: null, date_previsionnelle: "2026-11-02T14:30:00.000Z", date_reelle: null, est_un_jalon: false, responsable_user_id: ME, updated_at: null },
      // Sans date : absente du calendrier
      { id: "m4", project_id: "p2", libelle: "Sans date", statut: "a_faire", fait: false, echeance: null, date_previsionnelle: null, date_reelle: null, est_un_jalon: false, responsable_user_id: null, updated_at: null },
      // Legacy : seulement echeance
      { id: "m5", project_id: "p2", libelle: "Réserver la sono", statut: null, fait: false, echeance: "2027-05-01", date_previsionnelle: null, date_reelle: null, est_un_jalon: false, responsable_user_id: null, updated_at: null },
    ],
    commissions: [
      { id: "c1", nom: "Bâtiments", color: "#2F6FDB", icon: "Building", responsable_user_id: null },
      { id: "c2", nom: "Vie associative", color: "#B0306A", icon: "Users", responsable_user_id: null },
    ],
    sessions: [
      { id: "s1", commission_id: "c1", date_seance: "2026-10-20T18:30:00.000Z", lieu: "Salle du conseil", statut: "planifiee", secretaire_de_seance_user_id: null, updated_at: null },
      { id: "s2", commission_id: "c2", date_seance: "2026-10-22T18:30:00.000Z", lieu: null, statut: "planifiee", secretaire_de_seance_user_id: null, updated_at: null },
    ],
    financings: [
      { id: "f1", project_id: "p1", financeur: "Préfecture", statut: "demandee", date_demande: "2026-09-01", date_ar: null },
      { id: "f2", project_id: "p1", financeur: "Région", statut: "demandee", date_demande: "2026-09-01", date_ar: "2026-09-05" },
    ],
    contributors: [],
    commissionMembers: [{ commission_id: "c1", user_id: ME }],
    profiles: [{ id: ME, full_name: "Marie Martin" }, { id: "u-other", full_name: "Jean Dupont" }],
  };
}

describe("lot E — construction du calendrier", () => {
  const events = construireEvenements(raw(), NOW);
  const byId = new Map(events.map((e) => [e.id, e]));

  it("agrège étapes, date d'événement, séances et relances, les trois types confondus", () => {
    expect([...byId.keys()].sort()).toEqual(
      ["etape:m1", "etape:m2", "etape:m3", "etape:m5", "evenement:p2", "relance:f1", "seance:s1", "seance:s2"].sort(),
    );
  });

  it("ignore une étape sans date et une subvention ayant son accusé de réception", () => {
    expect(byId.has("etape:m4")).toBe(false);
    expect(byId.has("relance:f2")).toBe(false);
  });

  it("marque en retard une étape échue non terminée", () => {
    expect(byId.get("etape:m1")!.overdue).toBe(true);
    expect(byId.get("etape:m3")!.overdue).toBe(false);
  });

  it("retient la date réelle d'une étape terminée et garde la date prévue", () => {
    const m2 = byId.get("etape:m2")!;
    expect(m2.date.slice(0, 10)).toBe("2026-09-10");
    expect(m2.datePrevue?.slice(0, 10)).toBe("2026-09-01");
    expect(m2.overdue).toBe(false);
  });

  it("lit la date legacy « echeance » à défaut de date prévisionnelle", () => {
    expect(byId.get("etape:m5")!.date).toBe("2027-05-01T00:00:00.000Z");
    expect(byId.get("etape:m5")!.allDay).toBe(true);
  });

  it("distingue type de projet et commission", () => {
    const m1 = byId.get("etape:m1")!;
    expect(m1.typeCode).toBe("investissement");
    expect(m1.commission?.nom).toBe("Bâtiments");
    expect(registreVisuel(byId.get("evenement:p2")!)).toBe("event");
    expect(registreVisuel(byId.get("etape:m3")!)).toBe("tracking");
    const s1 = byId.get("seance:s1")!;
    expect(s1.typeCode).toBeNull();
    expect(registreVisuel(s1)).toBe("session");
    expect(libelleCategorie(s1)).toBe("Séance de commission");
  });

  it("place la relance 21 jours après le dépôt", () => {
    expect(byId.get("relance:f1")!.date.slice(0, 10)).toBe("2026-09-22");
    expect(byId.get("relance:f1")!.overdue).toBe(true);
  });

  it("donne l'élu référent en nom lisible", () => {
    expect(byId.get("etape:m1")!.referentName).toBe("Marie Martin");
  });

  it("écrit le type et le retard dans le texte accessible (jamais la couleur seule)", () => {
    const t = texteAccessible(byId.get("etape:m1")!);
    expect(t).toContain("Investissement");
    expect(t).toContain("jalon");
    expect(t).toContain("en retard");
    expect(t).toContain("commission Bâtiments");
  });

  it("trie par date", () => {
    const dates = events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("lot E — heures", () => {
  it("minuit UTC = journée entière (convention wallClockIso)", () => {
    expect(estJourneeEntiere("2026-10-01T00:00:00.000Z")).toBe(true);
    expect(estJourneeEntiere("2026-10-01")).toBe(true);
    expect(estJourneeEntiere("2026-10-01T14:30:00.000Z")).toBe(false);
  });
});

describe("lot E — filtres", () => {
  const events = construireEvenements(raw(), NOW);
  it("par type de projet ou séances", () => {
    expect(filtrerEvenements(events, { type: "evenementiel" }).map((e) => e.id).sort()).toEqual(["etape:m5", "evenement:p2"]);
    expect(filtrerEvenements(events, { type: "seance" }).every((e) => e.kind === "seance")).toBe(true);
  });
  it("par commission (projets pilotés et séances)", () => {
    expect(filtrerEvenements(events, { commissionId: "c1" }).map((e) => e.id).sort()).toEqual(
      ["etape:m1", "etape:m2", "relance:f1", "seance:s1"].sort(),
    );
  });
  it("par statut d'étape, dont « en retard »", () => {
    expect(filtrerEvenements(events, { statut: "retard" }).map((e) => e.id)).toEqual(["etape:m1"]);
    expect(filtrerEvenements(events, { statut: "termine" }).map((e) => e.id)).toEqual(["etape:m2"]);
  });
  it("par élu référent", () => {
    expect(filtrerEvenements(events, { referentId: "u-other" }).some((e) => e.projectId === "p1")).toBe(false);
  });
});

describe("lot E — périmètre « mes projets et mes commissions »", () => {
  const mes = construireEvenements(restreindreAuProfil(raw(), ME), NOW);
  const ids = mes.map((e) => e.id).sort();
  it("garde mes projets, mes commissions et les étapes dont je suis responsable", () => {
    expect(ids).toEqual(["etape:m1", "etape:m2", "etape:m3", "relance:f1", "seance:s1"].sort());
  });
  it("exclut les séances et projets des commissions dont je ne suis pas membre", () => {
    expect(ids).not.toContain("seance:s2");
    expect(ids).not.toContain("evenement:p2");
  });
});

describe("lot E — flux iCal", () => {
  const events = construireEvenements(raw(), NOW);
  const ics = buildIcsCalendar(versIcs(events, "https://gociviq.fr"), { name: "GoCiviq — Châteauneuf", now: NOW });

  it("produit un VCALENDAR valide avec fuseau Europe/Paris", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(events.length);
  });

  it("publie l'heure murale sans conversion", () => {
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20261020T183000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20261020T203000");
  });

  it("publie une journée entière avec DTEND exclusif", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261001");
    expect(ics).toContain("DTEND;VALUE=DATE:20261002");
  });

  it("des UID stables par élément", () => {
    expect(ics).toContain("UID:etape-m1@gociviq.fr");
    expect(ics).toContain("UID:seance-s1@gociviq.fr");
  });

  it("n'expose ni commentaire ni note interne", () => {
    expect(ics).not.toMatch(/note interne/i);
    expect(ics).toContain("Type : Investissement");
  });

  it("plie les lignes à 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("fenêtre externe : 12 mois en arrière", () => {
    const vieux = { ...events[0], date: "2025-01-01T00:00:00.000Z" };
    expect(dansFenetreExterne(vieux, NOW)).toBe(false);
    expect(dansFenetreExterne(events[0], NOW)).toBe(true);
  });

  it("liens d'abonnement Google et webcal", () => {
    const url = "https://gociviq.fr/api/agenda/abc.ics";
    expect(lienWebcal(url)).toBe("webcal://gociviq.fr/api/agenda/abc.ics");
    expect(lienAbonnementGoogle(url)).toBe(
      "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent("webcal://gociviq.fr/api/agenda/abc.ics"),
    );
  });
});

describe("lot E — Google Agenda", () => {
  const events = construireEvenements(raw(), NOW);
  const s1 = events.find((e) => e.id === "seance:s1")!;
  const m1 = events.find((e) => e.id === "etape:m1")!;

  it("identifiant déterministe au format base32hex", () => {
    const id = idGoogle("etape:m1", ME);
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(idGoogle("etape:m1", ME)).toBe(id);
    expect(idGoogle("etape:m1", "u-other")).not.toBe(id);
  });

  it("heure murale en Europe/Paris", () => {
    const r = versGoogle(s1, ME, "https://gociviq.fr");
    expect(r.start).toEqual({ dateTime: "2026-10-20T18:30:00", timeZone: "Europe/Paris" });
    expect(r.end).toEqual({ dateTime: "2026-10-20T20:30:00", timeZone: "Europe/Paris" });
  });

  it("journée entière avec fin exclusive", () => {
    const r = versGoogle(m1, ME, "https://gociviq.fr");
    expect(r.start).toEqual({ date: "2026-10-01" });
    expect(r.end).toEqual({ date: "2026-10-02" });
    expect(r.summary).toContain("(en retard)");
  });

  it("empreinte stable, sensible aux changements", () => {
    const a = versGoogle(m1, ME, "https://gociviq.fr");
    expect(empreinte(a)).toBe(empreinte(versGoogle(m1, ME, "https://gociviq.fr")));
    expect(empreinte({ ...a, summary: "autre" })).not.toBe(empreinte(a));
  });
});

describe("lot E — secrets Google", () => {
  beforeAll(() => {
    process.env.GOOGLE_TOKEN_KEY = "cle-de-test-uniquement";
  });

  it("chiffre et déchiffre le jeton de rafraîchissement", async () => {
    const { chiffrer, dechiffrer } = await import("@/lib/calendar/google");
    const enc = chiffrer("1//refresh-token");
    expect(enc).not.toContain("refresh");
    expect(dechiffrer(enc)).toBe("1//refresh-token");
  });

  it("refuse un état OAuth falsifié, expiré ou d'un autre navigateur", async () => {
    const { signerEtat, verifierEtat } = await import("@/lib/calendar/google");
    const s = signerEtat("u1", "nonce-1");
    expect(verifierEtat(s, "nonce-1")).toEqual({ ok: true, profileId: "u1" });
    expect(verifierEtat(s, "nonce-2").ok).toBe(false);
    expect(verifierEtat(s, undefined).ok).toBe(false);
    const [p] = s.split(".");
    expect(verifierEtat(`${p}.AAAA`, "nonce-1").ok).toBe(false);
    expect(verifierEtat(signerEtat("u1", "n", -1000), "n").ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { copieSans, lireListeEmails, listeCopie } from "@/lib/projects/copie";
import { convoqueParDefaut } from "@/lib/projects/emargement";
import { DEFAULT_PARAMETRES, validateParametresPatch } from "@/lib/projects/commune-parametres";
import { nomAgenda, restreindreAuxCommissions, slugAgenda, type CalendarRaw } from "@/lib/projects/calendar";
import { lireCommissions, urlFlux } from "@/lib/calendar/feed";
import { buildConvocationEmail } from "@/lib/emails/commission-convocation";

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";

describe("secrétariat en copie", () => {
  it("lit une liste saisie en texte, valide et dédoublonne", () => {
    expect(lireListeEmails("Secretariat@Mairie.fr\naccueil@mairie.fr; secretariat@mairie.fr")).toEqual({
      valides: ["secretariat@mairie.fr", "accueil@mairie.fr"], invalides: [],
    });
    expect(lireListeEmails("pas-une-adresse").invalides).toEqual(["pas-une-adresse"]);
    expect(lireListeEmails("")).toEqual({ valides: [], invalides: [] });
  });
  it("la liste de la commission remplace celle de la commune (même vide)", () => {
    expect(listeCopie(["a@m.fr"], null)).toEqual(["a@m.fr"]);
    expect(listeCopie(["a@m.fr"], ["b@m.fr"])).toEqual(["b@m.fr"]);
    expect(listeCopie(["a@m.fr"], [])).toEqual([]);
  });
  it("n'ajoute pas en copie un destinataire direct", () => {
    expect(copieSans(["a@m.fr", "b@m.fr"], ["A@m.fr"])).toEqual(["b@m.fr"]);
  });
  it("est validée dans les paramètres de la commune", () => {
    const actuel = { ...DEFAULT_PARAMETRES, commune_id: "x" };
    expect(validateParametresPatch({ copie_emails: "a@m.fr\nb@m.fr" }, actuel)).toEqual({ ok: true, updates: { copie_emails: ["a@m.fr", "b@m.fr"] } });
    const ko = validateParametresPatch({ copie_emails: "oups" }, actuel);
    expect(ko.ok).toBe(false);
  });
  it("la copie de convocation n'a ni réponse de présence ni lien personnel", () => {
    const e = buildConvocationEmail({
      siteUrl: "https://www.gociviq.fr", commune: { name: "Châteauneuf" }, commissionName: "Voirie",
      dateLabel: "lundi 3 novembre 2026 à 18 h 30", googleUrl: null, outlookUrl: null, copieDe: ["Camille", "Dominique"],
    });
    expect(e.subject.startsWith("Copie — Convocation : Voirie")).toBe(true);
    expect(e.html).toContain("Copie pour information");
    expect(e.html).toContain("2 destinataires");
    expect(e.html).not.toContain("Merci de confirmer votre présence");
    expect(e.text).not.toContain("Je serai présent");
  });
});

describe("titulaires et suppléants", () => {
  it("présélectionne les titulaires, les suppléants seulement si la commission le prévoit", () => {
    expect(convoqueParDefaut({ email: "a@m.fr" }, false)).toBe(true);
    expect(convoqueParDefaut({ email: "a@m.fr", suppleant: true }, false)).toBe(false);
    expect(convoqueParDefaut({ email: "a@m.fr", suppleant: true }, true)).toBe(true);
    expect(convoqueParDefaut({ email: null }, true)).toBe(false);
  });
});

describe("agenda filtré par commission et nommé", () => {
  const raw = {
    projects: [
      { id: "p1", commission_pilote_id: C1 }, { id: "p2", commission_pilote_id: C2 }, { id: "p3", commission_pilote_id: null },
    ],
    milestones: [{ id: "m1", project_id: "p1" }, { id: "m2", project_id: "p2" }],
    commissions: [{ id: C1, nom: "Voirie" }, { id: C2, nom: "Écoles" }],
    sessions: [{ id: "s1", commission_id: C1 }, { id: "s2", commission_id: C2 }],
    financings: [{ id: "f1", project_id: "p1" }, { id: "f3", project_id: "p3" }],
    contributors: [], commissionMembers: [], profiles: [],
  } as unknown as CalendarRaw;
  it("ne garde que les projets, étapes, séances et relances des commissions choisies", () => {
    const r = restreindreAuxCommissions(raw, [C1]);
    expect(r.projects.map((p) => p.id)).toEqual(["p1"]);
    expect(r.milestones.map((m) => m.id)).toEqual(["m1"]);
    expect(r.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(r.financings.map((f) => f.id)).toEqual(["f1"]);
    expect(restreindreAuxCommissions(raw, null)).toBe(raw);
    expect(restreindreAuxCommissions(raw, [])).toBe(raw);
  });
  it("donne un nom lisible à l'agenda et à son adresse", () => {
    expect(nomAgenda("Châteauneuf", "tout")).toBe("GoCiviq — Châteauneuf");
    expect(nomAgenda("Châteauneuf", "mes", ["Écoles", "Voirie"])).toBe("GoCiviq — Châteauneuf · Écoles, Voirie · mes projets");
    expect(nomAgenda("X", "tout", ["a", "b", "c", "d", "e"])).toBe("GoCiviq — X · a, b, c +2");
    expect(slugAgenda("GoCiviq — Châteauneuf · Écoles")).toBe("gociviq-chateauneuf-ecoles");
    expect(urlFlux("TOKEN", "gociviq-chateauneuf", "https://www.gociviq.fr")).toBe("https://www.gociviq.fr/api/agenda/TOKEN/gociviq-chateauneuf.ics");
    expect(urlFlux("TOKEN", null, "https://www.gociviq.fr")).toBe("https://www.gociviq.fr/api/agenda/TOKEN.ics");
  });
  it("lit le choix de commissions (vide = toutes)", () => {
    expect(lireCommissions(undefined)).toBeUndefined();
    expect(lireCommissions(null)).toBeNull();
    expect(lireCommissions([])).toBeNull();
    expect(lireCommissions([C1, C1, "pas-un-id"])).toEqual([C1]);
  });
});

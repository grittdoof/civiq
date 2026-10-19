import { describe, it, expect } from "vitest";
import { correspondStatut, lirePreferencesListe, PREFS_LISTE_DEFAUT, prefsEgales } from "@/lib/projects/preferences";
import { pageDOrigine, retourDepuis, RETOUR_PROJETS } from "@/lib/navigation/retour";
import { deplacerEtape, ordresPour } from "@/lib/projects/etapes";
import { dateEtape, messageEtape, messageVersHtml, validerDestinataires } from "@/lib/projects/envoi-etape";
import { alertesProjet, statutProjet, lireFiltres } from "@/lib/projects/pilotage";

const UUID = "0b8f9c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";

describe("préférences de la liste des projets", () => {
  it("retombe sur « Ouverts » pour toute valeur inconnue", () => {
    expect(lirePreferencesListe(null)).toEqual(PREFS_LISTE_DEFAUT);
    expect(lirePreferencesListe({ statut: "n'importe", types: ["x"], commissions: ["pas-un-id"] })).toEqual(PREFS_LISTE_DEFAUT);
  });
  it("garde les valeurs valides, sans doublon", () => {
    expect(lirePreferencesListe({ statut: "cloture", types: ["investissement", "investissement"], commissions: [UUID] }))
      .toEqual({ statut: "cloture", types: ["investissement"], commissions: [UUID] });
  });
  it("« Ouverts » exclut les projets clôturés", () => {
    expect(correspondStatut("ouverts", "en_cours")).toBe(true);
    expect(correspondStatut("ouverts", "termine")).toBe(true);
    expect(correspondStatut("ouverts", "cloture")).toBe(false);
    expect(correspondStatut("cloture", "cloture")).toBe(true);
    expect(correspondStatut("tous", "cloture")).toBe(true);
  });
  it("compare sans tenir compte de l'ordre", () => {
    expect(prefsEgales({ statut: "tous", types: ["evenementiel", "investissement"], commissions: [] },
      { statut: "tous", types: ["investissement", "evenementiel"], commissions: [] })).toBe(true);
  });
});

describe("statut clôturé", () => {
  it("prime sur l'avancement des étapes et coupe les alertes", () => {
    expect(statutProjet([], "2026-10-01T10:00:00Z")).toBe("cloture");
    expect(statutProjet([])).toBe("en_cours");
    const a = alertesProjet({
      projet: { id: "p", titre: "t", type_code: "investissement", commission: null, referent: null, avancement_pct: null, avancement_manuel_pct: null, confidentiel: false, clos_at: "2026-10-01" },
      etapes: [{ id: "e", project_id: "p", libelle: "x", statut: "a_faire", fait: false, echeance: "2020-01-01", date_previsionnelle: null } as never],
      lignes: [], subventions: [], devis: [], seuilDelegationHt: null, tauxFctva: 16.404,
    });
    expect(a.retards).toBe(0);
  });
  it("est accepté comme filtre du reporting", () => {
    expect(lireFiltres({ statut: "cloture" }).statut).toBe("cloture");
  });
});

describe("retour selon le parcours", () => {
  const base = "/admin/projects/abc";
  it("revient à la commission, à la séance, au calendrier ou au signalement", () => {
    expect(retourDepuis("/admin/commissions/c1", base)).toEqual({ href: "/admin/commissions/c1", label: "Retour à la commission" });
    expect(retourDepuis("/admin/commissions/c1/sessions/s1", base)?.label).toBe("Retour à la séance");
    expect(retourDepuis("/admin/calendrier?vue=mois", base)?.href).toBe("/admin/calendrier?vue=mois");
    expect(retourDepuis("/admin/tickets/t1", base)?.label).toBe("Retour au signalement");
    expect(retourDepuis("/admin/projects?onglet=reporting", base)).toEqual({ href: "/admin/projects?onglet=reporting", label: "Tous les projets" });
  });
  it("ignore les sous-pages du projet et les pages inconnues", () => {
    expect(retourDepuis("/admin/projects/abc/edit", base)).toBeNull();
    expect(retourDepuis("/admin/projects/abc?onglet=budget", base)).toBeNull();
    expect(retourDepuis("/admin/projects/nouveau", base)).toBeNull();
    expect(retourDepuis("https://exemple.org/x", base)).toBeNull();
    expect(RETOUR_PROJETS.href).toBe("/admin/projects");
  });
  it("lit la page d'origine même si le traceur a déjà noté la page courante", () => {
    expect(pageDOrigine("/admin/projects/abc", { courant: "/admin/commissions/c1", precedent: null })).toBe("/admin/commissions/c1");
    expect(pageDOrigine("/admin/projects/abc", { courant: "/admin/projects/abc", precedent: "/admin/calendrier" })).toBe("/admin/calendrier");
  });
});

describe("glisser-déposer des étapes", () => {
  it("déplace une étape et renumérote de 10 en 10", () => {
    expect(deplacerEtape(["a", "b", "c", "d"], "d", 1)).toEqual(["a", "d", "b", "c"]);
    expect(deplacerEtape(["a", "b", "c"], "a", 9)).toEqual(["b", "c", "a"]);
    expect(deplacerEtape(["a", "b"], "z", 0)).toEqual(["a", "b"]);
    expect([...ordresPour(["x", "y"])]).toEqual([["x", 10], ["y", 20]]);
  });
});

describe("envoi d'une étape par email", () => {
  const base = {
    projet: { titre: "Réfection de la cour d'école", commission: "Écoles" },
    etape: { libelle: "Demander trois devis", date_previsionnelle: "2026-11-05T14:30:00.000Z", statutLibelle: "À faire", commentaire: "Prévoir le lot peinture", commentaire_note_interne: false },
    contacts: [{ nom: "Durand", organisation: "Peinture & Co", email: "contact@peinture.fr", telephone: "06 00 00 00 00" }],
    pieces: ["cahier-des-charges.pdf"],
    expediteur: { nom: "Camille Martin", fonction: "adjointe" },
    commune: "Châteauneuf",
  };
  it("prérédige objet et message avec les informations utiles", () => {
    const { objet, message } = messageEtape(base);
    expect(objet).toBe("Réfection de la cour d'école — Demander trois devis");
    expect(message).toContain("(commission Écoles)");
    expect(message).toContain("Échéance : 5 novembre 2026 à 14 h 30");
    expect(message).toContain("Précisions : Prévoir le lot peinture");
    expect(message).toContain("Durand · (Peinture & Co) · contact@peinture.fr");
    expect(message).toContain("Pièces jointes : cahier-des-charges.pdf");
    expect(message).toContain("Camille Martin, adjointe");
    expect(message).toContain("Mairie de Châteauneuf");
  });
  it("n'inclut jamais un commentaire « note interne »", () => {
    const { message } = messageEtape({ ...base, etape: { ...base.etape, commentaire_note_interne: true } });
    expect(message).not.toContain("Prévoir le lot peinture");
  });
  it("valide et dédoublonne les adresses", () => {
    expect(validerDestinataires([" A@ex.fr ", "a@ex.fr", "b@ex.org"])).toEqual({ valides: ["a@ex.fr", "b@ex.org"], invalides: [] });
    expect(validerDestinataires(["pas-une-adresse", "x@y"]).invalides).toEqual(["pas-une-adresse", "x@y"]);
  });
  it("échappe le message en HTML", () => {
    const html = messageVersHtml("Bonjour <b>\nligne 2\n\nFin", (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;"), (h) => `<p>${h}</p>`);
    expect(html).toBe("<p>Bonjour &lt;b&gt;<br>ligne 2</p>\n<p>Fin</p>");
  });
  it("formate une journée entière sans heure", () => {
    expect(dateEtape("2026-11-05T00:00:00.000Z")).toBe("5 novembre 2026");
    expect(dateEtape(null)).toBeNull();
  });
});

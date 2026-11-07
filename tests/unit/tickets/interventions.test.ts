import { describe, expect, it } from "vitest";
import { MATRICE_COMPAT, MATRICE_DEFAUT, type DroitsTicket, type Fonction } from "@/lib/tickets/droits";
import {
  actionRapide, filtrerVue, grouperParUrgence, libelleVue, pageAccueil, trierInterventions,
  vueParDefaut, vuesDisponibles, type LigneIntervention,
} from "@/lib/tickets/interventions";

const ligne = (f: Fonction, m = MATRICE_DEFAUT) => m.find((l) => l.fonction === f)!;
const t = (o: Partial<LigneIntervention>): LigneIntervention => ({
  id: Math.random().toString(36).slice(2), created_at: "2026-11-01T08:00:00Z", created_by: "x",
  assigne_a: null, assignee_ids: [], service_id: null, urgence: "normale", delai_cible_le: null, statut: "nouveau", ...o,
});
const droits = (o: Partial<DroitsTicket> = {}): DroitsTicket => ({
  voir: true, prendreEnCharge: false, creer: false, modifier: false, assigner: false, changer_service: false,
  cloturer: false, rouvrir: false, commenter: true, changer_visibilite: false, exporter: false, ...o,
});

describe("page d'arrivée selon le profil", () => {
  it("chaque profil arrive au bon endroit", () => {
    expect(pageAccueil({ role: "editor", fonction: "agent", ticketsActif: true })).toBe("/admin/tickets?vue=moi");
    expect(pageAccueil({ role: "editor", fonction: "responsable_service", ticketsActif: true })).toBe("/admin/tickets?vue=service");
    expect(pageAccueil({ role: "editor", fonction: "adjoint", ticketsActif: true })).toBe("/admin/tickets?vue=service");
    expect(pageAccueil({ role: "editor", fonction: "accueil", ticketsActif: true })).toBe("/admin/tickets?vue=demandes");
    expect(pageAccueil({ role: "admin", fonction: "maire", ticketsActif: true })).toBe("/admin/dashboard");
    expect(pageAccueil({ role: "editor", fonction: "secretaire", ticketsActif: true })).toBe("/admin/dashboard");
    expect(pageAccueil({ role: "super_admin", fonction: "agent", ticketsActif: true })).toBe("/admin/dashboard");
    expect(pageAccueil({ role: "editor", fonction: "agent", ticketsActif: false })).toBe("/admin/dashboard");
  });
});

describe("onglets de la liste", () => {
  it("dépendent de la matrice de la commune", () => {
    expect(vuesDisponibles({ role: "editor", ligne: ligne("agent"), aDesServices: true })).toEqual(["moi", "service", "non_assignes", "demandes"]);
    expect(vuesDisponibles({ role: "editor", ligne: ligne("agent"), aDesServices: false })).toEqual(["moi", "non_assignes", "demandes"]);
    expect(vuesDisponibles({ role: "editor", ligne: ligne("conseiller"), aDesServices: false })).toEqual(["moi", "demandes"]);
    expect(vuesDisponibles({ role: "admin", ligne: ligne("maire"), aDesServices: false })).toEqual(["moi", "non_assignes", "demandes", "tous"]);
    expect(vuesDisponibles({ role: "editor", ligne: ligne("adjoint", MATRICE_COMPAT), aDesServices: true })).toContain("tous");
    expect(vuesDisponibles({ role: "editor", ligne: ligne("autre"), aDesServices: true })).toEqual([]);
  });
  it("onglet par défaut et libellé « Ma délégation »", () => {
    expect(vueParDefaut("agent", ["moi", "service", "demandes"])).toBe("moi");
    expect(vueParDefaut("adjoint", ["moi", "demandes"])).toBe("moi");
    expect(vueParDefaut("maire", ["moi", "demandes", "tous"])).toBe("tous");
    expect(libelleVue("service", "adjoint")).toBe("Ma délégation");
    expect(libelleVue("service", "agent")).toBe("Mon service");
  });
  it("filtre selon la vue", () => {
    const liste = [
      t({ id: "a", assigne_a: "moi" }), t({ id: "b", assignee_ids: ["moi"] }), t({ id: "c", service_id: "s1" }),
      t({ id: "d", created_by: "moi", assigne_a: "z" }),
    ];
    const ids = (v: Parameters<typeof filtrerVue>[1]) => filtrerVue(liste, v, "moi", new Set(["s1"])).map((x) => x.id);
    expect(ids("moi")).toEqual(["a", "b"]);
    expect(ids("service")).toEqual(["c"]);
    expect(ids("non_assignes")).toEqual(["c"]);
    expect(ids("demandes")).toEqual(["d"]);
    expect(ids("tous")).toHaveLength(4);
  });
});

describe("tri et sections par urgence", () => {
  it("danger d'abord, puis délai le plus proche, puis le plus ancien", () => {
    const liste = [
      t({ id: "n-recent", created_at: "2026-11-05T08:00:00Z" }),
      t({ id: "n-ancien", created_at: "2026-11-01T08:00:00Z" }),
      t({ id: "u-delai", urgence: "urgente", delai_cible_le: "2026-11-08T08:00:00Z" }),
      t({ id: "u-tard", urgence: "urgente", delai_cible_le: "2026-11-20T08:00:00Z" }),
      t({ id: "danger", urgence: "danger_immediat" }),
    ];
    expect(trierInterventions(liste).map((x) => x.id)).toEqual(["danger", "u-delai", "u-tard", "n-ancien", "n-recent"]);
    expect(grouperParUrgence(liste).map((g) => [g.urgence, g.tickets.length])).toEqual([["danger_immediat", 1], ["urgente", 2], ["normale", 2]]);
  });
});

describe("action rapide", () => {
  it("prendre, clôturer, photo ou rien", () => {
    expect(actionRapide(t({}), droits({ prendreEnCharge: true }), "moi")).toBe("prendre");
    expect(actionRapide(t({ assigne_a: "moi", statut: "pris_en_charge" }), droits({ cloturer: true, prendreEnCharge: true }), "moi")).toBe("cloturer");
    expect(actionRapide(t({ assigne_a: "z", statut: "en_cours" }), droits({ modifier: true, prendreEnCharge: true }), "moi")).toBe("photo");
    expect(actionRapide(t({ statut: "clos" }), droits({ prendreEnCharge: true }), "moi")).toBeNull();
    expect(actionRapide(t({}), droits(), "moi")).toBeNull();
  });
});

import { estErreurReseau, libelleFile } from "@/lib/tickets/hors-ligne-regles";

describe("mode hors ligne", () => {
  it("distingue une coupure réseau d'un refus du serveur", () => {
    expect(estErreurReseau(new Error("Permissions insuffisantes"), false)).toBe(true);
    expect(estErreurReseau(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(estErreurReseau(new Error("Load failed"), true)).toBe(true);
    expect(estErreurReseau(new Error("Permissions insuffisantes pour créer un ticket"), true)).toBe(false);
    expect(estErreurReseau(new Error("Catégorie inconnue"), true)).toBe(false);
  });
  it("libellé du bandeau", () => {
    expect(libelleFile(0, true)).toBeNull();
    expect(libelleFile(0, false)).toMatch(/Pas de réseau/);
    expect(libelleFile(1, true)).toBe("1 signalement en attente d'envoi");
    expect(libelleFile(2, false)).toMatch(/2 signalements en attente : envoi automatique/);
  });
});

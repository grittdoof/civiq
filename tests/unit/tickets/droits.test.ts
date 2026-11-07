import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIONS, MATRICE_COMPAT, MATRICE_DEFAUT, assignationAutorisee, droitsSurTicket, fonctionDe,
  normaliserLigne, peutAgir, peutCreer, peutPrendreEnCharge, peutVoirTicket, verifierVisibilite,
  type Fonction, type LigneMatrice, type Spectateur, type TicketPourDroits,
} from "@/lib/tickets/droits";

const C = "commune-1";
const AUTRE_C = "commune-2";
const SVC = "service-voirie";

const ligne = (f: Fonction, m: LigneMatrice[] = MATRICE_DEFAUT) => m.find((l) => l.fonction === f)!;
const qui = (id: string, f: Fonction, opts: Partial<Spectateur> = {}): Spectateur => ({
  id, role: "editor", communeId: C, ligne: ligne(f), services: new Set(), ...opts,
});
const ticket = (opts: Partial<TicketPourDroits> = {}): TicketPourDroits => ({
  commune_id: C, created_by: "createur", assigne_a: null, service_id: null,
  confidentialite: "standard", assignes: [], destinataires: [], ...opts,
});

describe("fonctions", () => {
  it("rattache chaque fonction à sa ligne de matrice", () => {
    expect(fonctionDe("agent_technique")).toBe("agent");
    expect(fonctionDe("secretaire")).toBe("secretaire");
    expect(fonctionDe("dst")).toBe("dst");
    expect(fonctionDe("citoyen")).toBe("autre");
    expect(fonctionDe(null)).toBe("autre");
  });
});

describe("visibilité (miroir de user_voit_ticket)", () => {
  it("super-admin : tout, toutes communes, confidentiel compris", () => {
    const sa = qui("sa", "autre", { role: "super_admin", communeId: null, ligne: null });
    expect(peutVoirTicket(ticket({ commune_id: AUTRE_C, confidentialite: "confidentiel" }), sa)).toBe(true);
  });

  it("jamais une autre commune, jamais un compte lecteur", () => {
    expect(peutVoirTicket(ticket({ commune_id: AUTRE_C }), qui("m", "maire"))).toBe(false);
    expect(peutVoirTicket(ticket(), qui("v", "maire", { role: "viewer" }))).toBe(false);
  });

  it("portée « toute la commune », « son service », « ses tickets », « rien »", () => {
    const t = ticket({ service_id: SVC });
    expect(peutVoirTicket(t, qui("m", "maire"))).toBe(true);
    expect(peutVoirTicket(t, qui("a", "agent"))).toBe(false);
    expect(peutVoirTicket(t, qui("a", "agent", { services: new Set([SVC]) }))).toBe(true);
    expect(peutVoirTicket(ticket(), qui("a", "agent", { services: new Set([SVC]) }))).toBe(false);
    expect(peutVoirTicket(t, qui("c", "conseiller"))).toBe(false);
    expect(peutVoirTicket(ticket({ created_by: "c" }), qui("c", "conseiller"))).toBe(true);
    expect(peutVoirTicket(ticket({ created_by: "x" }), qui("x", "autre"))).toBe(false);
  });

  it("créateur, assignés et destinataires voient toujours", () => {
    const c = qui("c", "conseiller");
    expect(peutVoirTicket(ticket({ assignes: ["c"] }), c)).toBe(true);
    expect(peutVoirTicket(ticket({ assigne_a: "c" }), c)).toBe(true);
    expect(peutVoirTicket(ticket({ destinataires: ["c"], confidentialite: "confidentiel" }), c)).toBe(true);
  });

  it("restreint : fonctions qui voient les restreints ; confidentiel : personne d'autre", () => {
    const r = ticket({ confidentialite: "restreint" });
    expect(peutVoirTicket(r, qui("s", "secretaire"))).toBe(true);
    expect(peutVoirTicket(r, qui("adj", "adjoint", { ligne: ligne("adjoint", MATRICE_COMPAT) }))).toBe(false);
    const conf = ticket({ confidentialite: "confidentiel" });
    expect(peutVoirTicket(conf, qui("m", "maire"))).toBe(false);
    expect(peutVoirTicket(conf, qui("m", "maire", { role: "admin" }))).toBe(false);
  });

  it("matrice de compatibilité : tout le monde voit les signalements standard", () => {
    for (const l of MATRICE_COMPAT) {
      expect(peutVoirTicket(ticket(), qui("x", l.fonction, { ligne: l }))).toBe(true);
    }
  });
});

describe("actions selon la matrice", () => {
  it("agent : modifie et clôture seulement ce qui lui est assigné", () => {
    const a = qui("a", "agent", { services: new Set([SVC]) });
    const libre = ticket({ service_id: SVC });
    const sien = ticket({ service_id: SVC, assignes: ["a"] });
    expect(peutAgir("cloturer", libre, a)).toBe(false);
    expect(peutAgir("cloturer", sien, a)).toBe(true);
    expect(peutAgir("modifier", sien, a)).toBe(true);
    expect(peutAgir("rouvrir", sien, a)).toBe(false);
    expect(peutPrendreEnCharge(libre, a)).toBe(true);
  });

  it("« si assigné » pour l'assignation : s'ajouter soi-même, sans retirer personne", () => {
    const a = qui("a", "agent", { services: new Set([SVC]) });
    const t = ticket({ service_id: SVC, assignes: ["b"] });
    expect(assignationAutorisee(t, a, ["b"], ["b", "a"])).toBe(true);
    expect(assignationAutorisee(t, a, ["b"], ["a"])).toBe(false);
    expect(assignationAutorisee(t, a, ["b"], ["b", "c"])).toBe(false);
    expect(assignationAutorisee(t, qui("r", "responsable_service", { services: new Set([SVC]) }), ["b"], ["c"])).toBe(true);
  });

  it("élu délégué : voit son service, commente, n'assigne pas par défaut", () => {
    const adj = qui("adj", "adjoint", { services: new Set([SVC]) });
    const t = ticket({ service_id: SVC });
    const d = droitsSurTicket(t, adj);
    expect(d.voir && d.commenter && d.exporter).toBe(true);
    expect(d.assigner || d.modifier || d.cloturer).toBe(false);
  });

  it("le créateur gère la visibilité de son signalement", () => {
    expect(peutAgir("changer_visibilite", ticket({ created_by: "c" }), qui("c", "conseiller"))).toBe(true);
    expect(peutAgir("changer_visibilite", ticket({ assignes: ["c"] }), qui("c", "conseiller"))).toBe(false);
  });

  it("création : selon la matrice, jamais pour « autre » ni un lecteur", () => {
    expect(peutCreer(qui("c", "conseiller"))).toBe(true);
    expect(peutCreer(qui("x", "autre"))).toBe(false);
    expect(peutCreer(qui("v", "maire", { role: "viewer" }))).toBe(false);
  });

  it("aucune action sans voir le signalement", () => {
    const conf = ticket({ confidentialite: "confidentiel" });
    for (const { action } of ACTIONS) expect(peutAgir(action, conf, qui("m", "maire"))).toBe(false);
  });
});

describe("lecture et contrôles", () => {
  it("normalise une ligne lue en base (valeurs inconnues → non)", () => {
    const l = normaliserLigne({ fonction: "agent", voit: "partout", voit_restreints: true, actions: { creer: "oui", rouvrir: "si_assigne", cloturer: "si_assigne", pirate: "oui" } });
    expect(l.voit).toBe("rien");
    expect(l.actions.creer).toBe("oui");
    expect(l.actions.rouvrir).toBe("non");
    expect(l.actions.cloturer).toBe("si_assigne");
    expect(l.actions.exporter).toBe("non");
  });

  it("restreint et confidentiel exigent un destinataire", () => {
    expect(verifierVisibilite("standard", [])).toBe("standard");
    expect(() => verifierVisibilite("restreint", [])).toThrow();
    expect(verifierVisibilite("confidentiel", ["x"])).toBe("confidentiel");
    expect(() => verifierVisibilite("secret", ["x"])).toThrow();
  });
});

describe("miroir SQL de la matrice par défaut (migration 058)", () => {
  const sql = readFileSync("supabase/migrations/058_tickets_droits.sql", "utf8");
  const bloc = sql.slice(sql.indexOf("  else\n"), sql.indexOf("  end if;\nend $$;"));
  it("chaque fonction a la même portée et les mêmes droits restreints", () => {
    for (const l of MATRICE_DEFAUT) {
      const m = bloc.match(new RegExp(`'${l.fonction}',\\s*'(\\w+)',\\s*(true|false)`));
      expect(m, l.fonction).not.toBeNull();
      expect(m![1]).toBe(l.voit);
      expect(m![2] === "true").toBe(l.voit_restreints);
    }
  });
  it("les droits « oui / si assigné » de l'agent sont identiques", () => {
    const m = bloc.match(/'agent',[^\n]*'(\{[^']*\})'\)/);
    const json = JSON.parse(m![1]) as Record<string, string>;
    const agent = ligne("agent");
    for (const [k, v] of Object.entries(json)) expect(agent.actions[k as keyof typeof agent.actions]).toBe(v);
  });
});

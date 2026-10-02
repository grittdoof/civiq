import { describe, expect, it } from "vitest";
import { estBureau, peutChangerConfidentialite, peutVoirProjet } from "@/lib/projects/confidentialite";
import {
  alertesProjet,
  calculerStatistiques,
  construireReporting,
  dateReporting,
  detailsCommentaire,
  filtrerProjets,
  libelleFiltres,
  lireFiltres,
  reportingEnTexte,
  statutProjet,
  type EtapePilotage,
  type ProjetPilotage,
  type StatutProjet,
  type SubventionPilotage,
} from "@/lib/projects/pilotage";
import { construireFiche, eur, nomFichier } from "@/lib/projects/fiche";
import type { LigneBudget } from "@/lib/projects/financement";
import { dimensionsImage, ficheDocx, reportingDocx } from "@/lib/projects/docx-pilotage";

const NOW = new Date("2026-09-29T09:00:00Z");

const etape = (o: Partial<EtapePilotage> & { id: string; project_id: string; libelle: string }): EtapePilotage => ({
  statut: "a_faire", fait: false, echeance: null, date_previsionnelle: null, date_reelle: null, est_un_jalon: false,
  remonter_au_reporting: false, commentaire: null, commentaire_note_interne: false, ordre: null, ...o,
});
const projet = (o: Partial<ProjetPilotage> & { id: string; titre: string }): ProjetPilotage => ({
  type_code: "investissement", commission: null, referent: null, avancement_pct: null, avancement_manuel_pct: null, confidentiel: false, ...o,
});
const ligne = (o: Partial<LigneBudget>): LigneBudget => ({ sens: "depense", base: "ht", taux_tva: 20, etat: "previsionnel", montant_prevu: 0, montant_reel: null, ...o });

describe("lot F — confidentialité (miroir de user_voit_projet)", () => {
  const p = { id: "p1", confidentiel: true, pilote_elu: "u-ref", pilote_agent: "u-agent" };
  it("un projet non confidentiel est visible de tous", () => {
    expect(peutVoirProjet({ id: "x", role: "editor" }, { ...p, confidentiel: false })).toBe(true);
  });
  it("bureau municipal (admin, super_admin) : visible", () => {
    expect(peutVoirProjet({ id: "x", role: "admin" }, p)).toBe(true);
    expect(peutVoirProjet({ id: "x", role: "super_admin" }, p)).toBe(true);
  });
  it("élu référent, agent et contributeurs : visible", () => {
    expect(peutVoirProjet({ id: "u-ref", role: "editor" }, p)).toBe(true);
    expect(peutVoirProjet({ id: "u-agent", role: "editor" }, p)).toBe(true);
    expect(peutVoirProjet({ id: "u-c", role: "editor" }, p, ["u-c"])).toBe(true);
  });
  it("autre éditeur ou hors session : invisible", () => {
    expect(peutVoirProjet({ id: "x", role: "editor" }, p)).toBe(false);
    expect(peutVoirProjet(null, p)).toBe(false);
  });
  it("seul le bureau change la confidentialité", () => {
    expect(peutChangerConfidentialite({ id: "u-ref", role: "editor" })).toBe(false);
    expect(peutChangerConfidentialite({ id: "a", role: "admin" })).toBe(true);
    expect(estBureau("viewer")).toBe(false);
  });
});

describe("lot F — statut et alertes d'un projet", () => {
  it("terminé seulement si toutes les étapes sont terminées", () => {
    expect(statutProjet([])).toBe("en_cours");
    expect(statutProjet([etape({ id: "a", project_id: "p", libelle: "x", statut: "termine" })])).toBe("termine");
    expect(statutProjet([
      etape({ id: "a", project_id: "p", libelle: "x", statut: "termine" }),
      etape({ id: "b", project_id: "p", libelle: "y", statut: "en_cours" }),
    ])).toBe("en_cours");
    // legacy : fait=true sans statut
    expect(statutProjet([etape({ id: "a", project_id: "p", libelle: "x", statut: null, fait: true })])).toBe("termine");
  });

  const base = {
    projet: projet({ id: "p1", titre: "Église" }),
    etapes: [etape({ id: "m", project_id: "p1", libelle: "Dépôt", date_previsionnelle: "2026-09-01T00:00:00.000Z" })],
    lignes: [ligne({ montant_prevu: 100_000 })],
    subventions: [{ project_id: "p1", statut: "accordee", montant_demande: 90_000, montant_obtenu: 90_000, date_demande: "2026-06-01", date_ar: "2026-06-10" }] as SubventionPilotage[],
    devis: [],
    seuilDelegationHt: 40_000,
    tauxFctva: 16.404,
    now: NOW,
  };
  it("retard, part communale sous 20 %, délégation dépassée", () => {
    const a = alertesProjet(base);
    expect(a.retards).toBe(1);
    expect(a.partCommuneKo).toBe(true);
    expect(a.delegationDepassee).toBe(true);
    expect(a.subventionsSansAr).toBe(0);
  });
  it("subvention déposée sans accusé de réception depuis plus de 21 jours", () => {
    const a = alertesProjet({ ...base, subventions: [{ project_id: "p1", statut: "demandee", montant_demande: 10_000, montant_obtenu: null, date_demande: "2026-08-01", date_ar: null }] });
    expect(a.subventionsSansAr).toBe(1);
  });
  it("silence sur la délégation si le paramètre n'est pas renseigné, et pour un événement", () => {
    expect(alertesProjet({ ...base, seuilDelegationHt: null }).delegationDepassee).toBe(false);
    const ev = alertesProjet({ ...base, projet: projet({ id: "p1", titre: "Fête", type_code: "evenementiel" }) });
    expect(ev.delegationDepassee).toBe(false);
    expect(ev.partCommuneKo).toBe(false);
  });
});

describe("lot F — statistiques", () => {
  const c1 = { id: "c1", nom: "Bâtiments", color: "#2F6FDB" };
  const projets = [
    projet({ id: "a", titre: "A", commission: c1, avancement_pct: 50 }),
    projet({ id: "b", titre: "B", commission: c1, avancement_pct: null, avancement_manuel_pct: 100 }),
    projet({ id: "c", titre: "C", commission: null, avancement_pct: null }),
  ];
  const lignes = new Map<string, LigneBudget[]>([
    ["a", [ligne({ montant_prevu: 1000 }), ligne({ montant_prevu: 500, etat: "engage", montant_reel: 600 }), ligne({ montant_prevu: 200, etat: "mandate", montant_reel: 200 })]],
    ["c", [ligne({ base: "ttc", montant_prevu: 1200 })]],
  ]);
  const subs = new Map<string, SubventionPilotage[]>([
    ["a", [
      { project_id: "a", statut: "demandee", montant_demande: 300, montant_obtenu: null, date_demande: null, date_ar: null },
      { project_id: "a", statut: "accordee", montant_demande: 400, montant_obtenu: 350, date_demande: null, date_ar: null },
      { project_id: "a", statut: "soldee", montant_demande: 100, montant_obtenu: 100, date_demande: null, date_ar: null },
      { project_id: "a", statut: "a_demander", montant_demande: 999, montant_obtenu: null, date_demande: null, date_ar: null },
    ]],
  ]);
  const s = calculerStatistiques({ projets, lignesParProjet: lignes, subventionsParProjet: subs });

  it("avancement général : moyenne des projets renseignés (surcharge manuelle comprise)", () => {
    expect(s.avancementGeneral).toBe(75);
    expect(s.nbAvancementRenseigne).toBe(2);
  });
  it("par commission, « Sans commission » en dernier", () => {
    expect(s.parCommission.map((l) => l.nom)).toEqual(["Bâtiments", "Sans commission"]);
    expect(s.parCommission[0].avancement).toBe(75);
    expect(s.parCommission[1].avancement).toBeNull();
  });
  it("budget HT : prévu, engagé, payé (trois séries)", () => {
    expect(s.parCommission[0]).toMatchObject({ prevuHt: 1700, engageHt: 800, mandateHt: 200 });
    expect(s.parCommission[1].prevuHt).toBe(1000); // 1200 TTC → HT
  });
  it("subventions : sollicitées / accordées / encaissées", () => {
    expect(s.subventions).toEqual({ sollicitees: 800, accordees: 450, encaissees: 100 });
  });
});

describe("lot F — reporting à trois niveaux", () => {
  const projets = [
    projet({ id: "p1", titre: "Rue Rivaudeau", commission: { id: "v", nom: "Voirie", color: null } }),
    projet({ id: "p2", titre: "Allée des Chênes (eaux pluviales)", commission: { id: "v", nom: "Voirie", color: null } }),
    projet({ id: "p3", titre: "Sans étape remontée" }),
  ];
  const etapes = new Map<string, EtapePilotage[]>([
    ["p1", [
      etape({ id: "a", project_id: "p1", libelle: "Devis reçu : effacement du marquage — 458 €", remonter_au_reporting: true, ordre: 1 }),
      etape({ id: "b", project_id: "p1", libelle: "Décroutage de l'enrobé + aménagement", remonter_au_reporting: true, ordre: 2,
        commentaire: "- 1 devis en attente — CROCHET TP\n• RDV AMEAS en cours — cf. Aurélien" }),
      etape({ id: "c", project_id: "p1", libelle: "Note confidentielle", remonter_au_reporting: true, ordre: 3, commentaire: "Négociation", commentaire_note_interne: true }),
      etape({ id: "d", project_id: "p1", libelle: "Pas au reporting", remonter_au_reporting: false }),
    ]],
    ["p2", [
      etape({ id: "e", project_id: "p2", libelle: "Rendez-vous avec les administrés", remonter_au_reporting: true, ordre: 1, date_previsionnelle: "2026-07-31T11:00:00.000Z" }),
      etape({ id: "f", project_id: "p2", libelle: "Intervention AMEAS pour évaluation", remonter_au_reporting: true, ordre: 2, date_previsionnelle: "2026-09-01T00:00:00.000Z" }),
    ]],
    ["p3", [etape({ id: "g", project_id: "p3", libelle: "x" })]],
  ]);
  const items = construireReporting(projets, etapes);

  it("n'inclut que les étapes marquées « remonter au reporting »", () => {
    expect(items.map((i) => i.titre)).toEqual(["Allée des Chênes (eaux pluviales)", "Rue Rivaudeau"]);
    expect(items[1].lignes.map((l) => l.texte)).not.toContain("Pas au reporting");
  });
  it("niveau 3 = lignes du commentaire, puces saisies retirées", () => {
    expect(items[1].lignes[1].sous).toEqual(["1 devis en attente — CROCHET TP", "RDV AMEAS en cours — cf. Aurélien"]);
  });
  it("jamais de note interne", () => {
    expect(items[1].lignes[2].sous).toEqual([]);
    expect(reportingEnTexte(items)).not.toContain("Négociation");
  });
  it("dates au format du modèle", () => {
    expect(items[0].lignes[0].texte).toBe("Rendez-vous avec les administrés — 31 juillet 2026, 11h");
    expect(items[0].lignes[1].texte).toBe("Intervention AMEAS pour évaluation — 1er septembre 2026");
    expect(dateReporting("2026-07-31T11:30:00.000Z")).toBe("31 juillet 2026, 11h30");
  });
  it("tabulation stricte à trois niveaux dans le texte copié", () => {
    const t = reportingEnTexte(items);
    expect(t).toContain("• Rue Rivaudeau\n    ◦ Devis reçu");
    expect(t).toContain("\n        ▪ 1 devis en attente — CROCHET TP");
  });
  it("filtres commission / type / statut", () => {
    const statuts = new Map<string, StatutProjet>([["p1", "en_cours"], ["p2", "termine"], ["p3", "en_cours"]]);
    expect(filtrerProjets(projets, statuts, { commissionId: "v" }).length).toBe(2);
    expect(filtrerProjets(projets, statuts, { commissionId: "__sans__" }).map((p) => p.id)).toEqual(["p3"]);
    expect(filtrerProjets(projets, statuts, { statut: "termine" }).map((p) => p.id)).toEqual(["p2"]);
    expect(lireFiltres({ type: "hack", statut: "termine", commission: "v" })).toEqual({ commissionId: "v", type: "", statut: "termine" });
    expect(libelleFiltres({ commissionId: "v", statut: "en_cours" }, [{ id: "v", nom: "Voirie" }], "29 septembre 2026"))
      .toBe("Commission Voirie · En cours — au 29 septembre 2026");
  });
  it("detailsCommentaire ignore les lignes vides", () => {
    expect(detailsCommentaire("\n  \n- a\n")).toEqual(["a"]);
  });
});

describe("lot F — fiche projet A4", () => {
  const input = {
    projet: { titre: "Réfection de l'église", type_code: "investissement" as const, description: "Toiture", photo_url: null, confidentiel: true, avancement_pct: 40, avancement_manuel_pct: null },
    commission: "Bâtiments",
    referent: "Marie Martin",
    etapes: [
      etape({ id: "a", project_id: "p", libelle: "Choix de l'architecte", est_un_jalon: true, statut: "termine", date_reelle: "2026-03-01T00:00:00.000Z", commentaire: "Cabinet X retenu" }),
      etape({ id: "b", project_id: "p", libelle: "Négociation terrain", est_un_jalon: true, commentaire: "Prix plafond 30 k€", commentaire_note_interne: true }),
      etape({ id: "c", project_id: "p", libelle: "Étape non jalon" }),
    ],
    lignes: [ligne({ montant_prevu: 100_000 })],
    subventions: [{ statut: "accordee" as const, montant_demande: 40_000, montant_obtenu: 35_000, financeur: "Préfecture", dispositif: "DETR" }],
    deliberations: [{ numero: "2026-12", date_seance: "2026-02-10", objet: "Lancement" }],
    documents: [{ nom: "Devis.pdf" }, { nom: "Note négociation.pdf", note_interne: true }],
    tauxFctva: 16.404,
    now: NOW,
  };

  it("complète : notes internes incluses et signalées", () => {
    const f = construireFiche({ ...input, variante: "complete" });
    // Toutes les étapes figurent (jalons repérés, pas filtrés), dans l'ordre du projet.
    expect(f.etapesTitre).toBe("Étapes et jalons");
    expect(f.etapes.map((e) => e.libelle)).toEqual(["Choix de l'architecte", "Négociation terrain", "Étape non jalon"]);
    expect(f.etapes.map((e) => e.jalon)).toEqual([true, true, false]);
    expect(f.etapesMasquees).toBe(0);
    expect(f.etapes[1]).toMatchObject({ commentaire: "Prix plafond 30 k€", noteInterne: true });
    expect(f.documents.length).toBe(2);
    expect(f.confidentiel).toBe(true);
  });
  it("ordre saisi respecté, étapes sans date comprises (cas réel : 11 étapes ajoutées)", () => {
    const etapes = Array.from({ length: 34 }, (_, i) =>
      etape({ id: `e${i}`, project_id: "p", libelle: `Étape ${i}`, ordre: (34 - i) * 10, est_un_jalon: i === 0, date_previsionnelle: i % 2 ? null : "2026-10-02T00:00:00.000Z" }));
    const f = construireFiche({ ...input, variante: "complete", etapes });
    expect(f.etapes[0].libelle).toBe("Étape 33");
    expect(f.etapes.length).toBe(30);
    expect(f.etapesMasquees).toBe(4);
  });

  it("communicable : aucune note interne (commentaire ni pièce)", () => {
    const f = construireFiche({ ...input, variante: "communicable" });
    expect(f.etapes[1].commentaire).toBeNull();
    expect(f.etapes[0].commentaire).toBe("Cabinet X retenu");
    expect(f.documents.map((d) => d.nom)).toEqual(["Devis.pdf"]);
  });
  it("investissement : plan de financement avec les deux ratios", () => {
    const f = construireFiche({ ...input, variante: "complete" });
    expect(f.budget?.kind).toBe("investissement");
    if (f.budget?.kind === "investissement") {
      expect(f.budget.plan.part_commune_pct).toBe(65);
      expect(f.budget.plan.controle_aides_ok).toBe(true);
    }
    expect(f.subventions[0]).toMatchObject({ financeur: "Préfecture — DETR", statut: "Accordée", obtenu: 35_000 });
    expect(f.deliberations[0]).toMatchObject({ numero: "2026-12", date: "10 février 2026" });
  });
  it("événement : budget recettes / dépenses et rétroplanning, jamais de plan de financement", () => {
    const f = construireFiche({
      ...input,
      variante: "complete",
      projet: { ...input.projet, type_code: "evenementiel", evenement_debut: "2026-06-21T18:00:00.000Z", lieu: "Place" },
      lignes: [ligne({ base: "ttc", montant_prevu: 3000 }), ligne({ sens: "recette", base: "ttc", montant_prevu: 1000 })],
    });
    expect(f.budget).toEqual({ kind: "fonctionnement", depensesTtc: 3000, recettesTtc: 1000, soldeTtc: -2000 });
    expect(f.etapesTitre).toBe("Rétroplanning");
    expect(f.etapes.length).toBe(3);
    expect(f.subventions).toEqual([]);
  });
  it("montants et noms de fichiers", () => {
    expect(eur(1234)).toBe("1 234 €");
    expect(nomFichier("Réfection de l'église !", "fiche-complete", "pdf")).toBe("refection-de-l-eglise-fiche-complete.pdf");
  });
});

describe("lot F — Word réellement éditable", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000064000000320806000000", "hex");
  it("lit les dimensions d'un PNG", () => {
    expect(dimensionsImage(png)).toEqual({ type: "png", width: 100, height: 50 });
    expect(dimensionsImage(Buffer.from("nope"))).toBeNull();
  });

  const env = { communeName: "Châteauneuf", communeLogoUrl: null, editedOn: "29 septembre 2026" };
  it("génère un .docx (archive OOXML) pour la fiche", async () => {
    const f = construireFiche({
      variante: "communicable",
      projet: { titre: "Test", type_code: "suivi_simple", description: null, photo_url: null, confidentiel: false, avancement_pct: null, avancement_manuel_pct: null },
      commission: null, referent: null, etapes: [], lignes: [], subventions: [], deliberations: [], documents: [], tauxFctva: 16.404,
    });
    const buf = await ficheDocx(f, env);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(3000);
  });
  it("génère un .docx pour le reporting avec une liste à trois niveaux", async () => {
    const buf = await reportingDocx([{ id: "p", titre: "Rue", type: "investissement", commission: null, lignes: [{ texte: "Devis", sous: ["détail"] }] }], "Tous les projets", env);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});

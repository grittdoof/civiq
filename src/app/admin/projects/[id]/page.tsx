import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Layers, MapPin, Pencil, UserRound, Users } from "lucide-react";
import "../projects.css";
import "../flow.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getCommuneSettings, getProject, listStakeholders } from "@/lib/projects/queries";
import type { TypeProjetCode } from "@/lib/projects/types";
import {
  avancementAffiche, formatEtapeDate, isEnRetard, joursAvant, libelleCompteARebours,
} from "@/lib/projects/etapes";
import { FOURCHETTES } from "@/lib/projects/wizard";
import { formatEuros } from "@/lib/projects/cost-calc";
import { consommationBudget, subventionSansAr, totauxBudget, type PlanFinancement as Plan } from "@/lib/projects/financement";
import { evaluerAlertesMarches, montantReferenceMarche, type Seuil } from "@/lib/projects/marches";
import TypeBadge from "@/components/projects/TypeBadge";
import Gauge from "@/components/projects/GaugeLazy";
import EtapesEditor from "@/components/projects/EtapesEditor";
import PartiesPrenantesEditor from "@/components/projects/PartiesPrenantesEditor";
import DocumentsEditor from "@/components/projects/DocumentsEditor";
import DevisComparator, { type DevisRow } from "@/components/projects/DevisComparator";
import BudgetEditor, { type BudgetRow } from "@/components/projects/BudgetEditor";
import SubventionsEditor, { type SubventionRow } from "@/components/projects/SubventionsEditor";
import PlanFinancement from "@/components/projects/PlanFinancement";
import PistesFinancement from "@/components/projects/PistesFinancement";
import ProjectDatesEditor from "@/components/projects/ProjectDatesEditor";
import { suggererAides, type AideCache } from "@/lib/aides/aides";
import ProjectPhotoUpload from "@/components/projects/ProjectPhotoUpload";
import ProjectTypeChanger from "@/components/projects/ProjectTypeChanger";
import AvancementAjuster from "@/components/projects/AvancementAjuster";
import SuiviActions from "@/components/projects/SuiviActions";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id] — écran de vie du projet (brief §2.3, lot B).
//
// Une seule vue principale (étapes, ou rétroplanning pour un
// événement) ; le reste en onglets secondaires selon le type. Bandeau
// compact : photo, titre, type, commission, élu référent, deux jauges.
//
// Lot C : Budget (HT pour un investissement, TTC pour un événement),
// Devis (seuils datés, délégation au maire), Financeurs (accusés de
// réception) et Plan de financement (contrôles 20 % / 80 % côté serveur).
// Un événement n'affiche jamais ni plan de financement, ni FCTVA.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type Onglet = "etapes" | "retroplanning" | "budget" | "devis" | "financeurs" | "partenaires" | "documents";

const ONGLETS: Record<TypeProjetCode, Array<{ key: Onglet; label: string }>> = {
  investissement: [
    { key: "etapes", label: "Étapes" },
    { key: "budget", label: "Budget" },
    { key: "devis", label: "Devis" },
    { key: "financeurs", label: "Financeurs" },
    { key: "documents", label: "Documents" },
  ],
  evenementiel: [
    { key: "retroplanning", label: "Rétroplanning" },
    { key: "budget", label: "Budget" },
    { key: "partenaires", label: "Partenaires" },
    { key: "documents", label: "Documents" },
  ],
  suivi_simple: [{ key: "etapes", label: "Étapes" }],
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}

export default async function ProjectLifePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { onglet } = await searchParams;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const [detail, directory] = await Promise.all([getProject(ctx.communeId, id), listStakeholders(ctx.communeId)]);
  const p = detail.project;
  if (!p) notFound();

  const service = await createServiceClient();
  const [{ data: budgetData }, { data: quotesData }, { data: seuilsData }, settings, { data: planData }, { data: financingsData }] =
    await Promise.all([
      service.from("project_budget_lines")
        .select("id, sens, categorie, libelle, montant_prevu, montant_reel, base, taux_tva, etat, chapitre_m57, operation, notes")
        .is("deleted_at", null).eq("project_id", id).order("created_at"),
      service.from("project_quotes")
        .select("id, prestataire, contact_id, objet, lot, montant_ht, taux_tva, montant_ttc, date_reception, validite, statut, document_id, notes")
        .is("deleted_at", null).eq("project_id", id).order("lot", { nullsFirst: true }).order("montant_ht"),
      service.from("seuils_commande_publique").select("categorie, type, montant_ht, date_effet, date_fin, reference"),
      getCommuneSettings(ctx.communeId),
      service.rpc("project_financement", { p_project_id: id }),
      service.from("financings")
        .select("id, financeur, dispositif, statut, assiette_ht, montant_demande, montant_obtenu, date_demande, date_ar, date_decision, notes, aide_ref")
        .is("deleted_at", null).eq("project_id", id).order("created_at"),
    ]);
  const budgetRows = (budgetData ?? []) as unknown as BudgetRow[];
  const devisRows = (quotesData ?? []) as unknown as DevisRow[];
  const seuils = ((seuilsData ?? []) as unknown as Seuil[]).map((x) => ({ ...x, montant_ht: Number(x.montant_ht) }));
  const subventions = (financingsData ?? []) as unknown as SubventionRow[];
  const serverPlan = (planData ?? null) as Plan | null;

  const canEdit = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");
  const type = (p.type_code ?? "suivi_simple") as TypeProjetCode;
  const blocsSupp = (p as { blocs_supplementaires?: string[] }).blocs_supplementaires ?? [];
  const tabs = [...ONGLETS[type]];
  if (type === "suivi_simple" && (blocsSupp.includes("devis"))) tabs.push({ key: "devis", label: "Devis" });
  const current: Onglet = tabs.some((t) => t.key === onglet) ? (onglet as Onglet) : tabs[0].key;

  const ext = p as typeof p & {
    commission_pilote_id?: string | null;
    fourchette_estimation?: string | null;
    echeance_souhaitee?: string | null;
    evenement_debut?: string | null;
    evenement_fin?: string | null;
    lieu?: string | null;
    jauge?: number | null;
  };
  const commission = detail.commissions.find((c) => c.id === ext.commission_pilote_id) ?? detail.commissions[0] ?? null;
  const avancement = avancementAffiche(p);
  const now = new Date();
  const retards = detail.milestones.filter((m) => isEnRetard(m, now)).length;
  const legacyHref = `/admin/projects/${id}/phase/${p.phase}`;
  const extC = p as typeof p & {
    date_consultation?: string | null;
    categorie_achat?: "travaux" | "fournitures_services";
    emprunt_prevu?: number | null;
    autofinancement_invest?: number | null;
    autofinancement_fonct?: number | null;
    autofinancement_assume?: boolean;
    autofinancement_assume_par?: string | null;
    autofinancement_assume_le?: string | null;
  };
  const baseBudget = type === "investissement" ? "ht" : "ttc";
  const totaux = totauxBudget(budgetRows, baseBudget);
  const consommation = consommationBudget(totaux);
  const parametresMarches = {
    seuil_delegation_maire_ht: settings.seuil_delegation_maire_ht,
    delegation_deliberation_num: settings.delegation_deliberation_num,
    delegation_deliberation_date: settings.delegation_deliberation_date,
    regles_internes_actives: settings.regles_internes_actives,
    nb_devis_exige: settings.nb_devis_exige,
    seuil_devis_exige_ht: settings.seuil_devis_exige_ht,
  };
  const dateConsultation = extC.date_consultation
    ?? devisRows.map((d) => d.date_reception).filter((d): d is string => !!d).sort()[0]
    ?? new Date().toISOString().slice(0, 10);
  const alertesMarches = type === "evenementiel" ? [] : evaluerAlertesMarches({
    montantHt: montantReferenceMarche(devisRows, type === "investissement" ? totaux.prevu : null).montant,
    categorie: extC.categorie_achat ?? "travaux",
    dateConsultation,
    nbDevis: devisRows.length,
    seuils,
    parametres: parametresMarches,
  });
  const delegationDepassee = alertesMarches.some((a) => a.code === "delegation");
  const partCommuneKo = type === "investissement" && serverPlan?.controle_part_commune_ok === false;
  const subventionsSansAr = subventions.filter((s) => subventionSansAr(s, now)).length;
  // Pistes de financement : lues dans le cache (jamais l'API en direct),
  // uniquement quand l'onglet Financeurs est affiché.
  const pistes: { aides: AideCache[]; locaux: Array<{ id: string; nom: string; periode_depot: string | null; lien: string | null; notes: string | null }>; miseAJour: string | null } =
    { aides: [], locaux: [], miseAJour: null };
  if (current === "financeurs") {
    const [{ data: cache }, { data: locaux }, { data: sync }] = await Promise.all([
      service.from("aides_cache").select("*").eq("commune_id", ctx.communeId),
      service.from("financeurs_locaux").select("id, nom, periode_depot, lien, notes, types_projet")
        .eq("commune_id", ctx.communeId).is("deleted_at", null).order("nom"),
      service.from("aides_sync_log").select("finished_at").eq("commune_id", ctx.communeId).eq("ok", true)
        .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const deja = new Set(subventions.map((f) => (f as unknown as { aide_ref?: string | null }).aide_ref).filter(Boolean));
    pistes.aides = suggererAides((cache ?? []) as unknown as AideCache[], { titre: p.titre, description: p.description }, now.toISOString().slice(0, 10))
      .filter((a) => !deja.has(a.aide_id));
    pistes.locaux = ((locaux ?? []) as Array<{ id: string; nom: string; periode_depot: string | null; lien: string | null; notes: string | null; types_projet: string[] }>)
      .filter((f) => f.types_projet.includes(type));
    pistes.miseAJour = (sync?.finished_at as string | null) ?? null;
  }
  let assumePar: string | null = null;
  if (extC.autofinancement_assume && extC.autofinancement_assume_par) {
    const { data: prof } = await service.from("profiles").select("full_name").eq("id", extC.autofinancement_assume_par).maybeSingle();
    assumePar = (prof?.full_name as string | null) ?? null;
  }
  const jours = ext.evenement_debut ? joursAvant(ext.evenement_debut, now) : null;
  const archived = !!p.archived_at;

  return (
    <main className="civiq-main pj-life">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
      </div>

      {archived && (
        <p className="pj-alerte pj-alerte-information" role="status">
          Ce projet est archivé{p.archive_motif ? ` : ${p.archive_motif}` : ""}. Il reste consultable.
        </p>
      )}

      {/* ─── Bandeau ─── */}
      <header className="civiq-card pj-life-head">
        <div className="pj-life-photo">
          <ProjectPhotoUpload projectId={id} current={p.photo_url} canEdit={canEdit && !archived} />
        </div>
        <div className="pj-life-id">
          <div className="pj-life-badges">
            <TypeBadge type={type} />
            {commission && (
              <span className="pj-commission-badge" style={{ ["--comm-color" as string]: commission.color }}>
                <span className="pj-wiz-dot" style={{ background: commission.color }} aria-hidden="true" />
                {commission.nom}
              </span>
            )}
            {retards > 0 && (
              <span className="civiq-badge civiq-badge-warning">{retards} étape{retards > 1 ? "s" : ""} en retard</span>
            )}
            {delegationDepassee && <span className="civiq-badge civiq-badge-error">Délibération du conseil nécessaire</span>}
            {partCommuneKo && <span className="civiq-badge civiq-badge-error">Part communale sous 20 %</span>}
            {subventionsSansAr > 0 && (
              <span className="civiq-badge civiq-badge-warning">Subvention sans accusé de réception</span>
            )}
          </div>
          <h1 className="pj-life-title">{p.titre}</h1>
          <ul className="pj-life-facts">
            <li><UserRound size={14} aria-hidden="true" /> Élu référent : {p.pilote_elu_profile?.full_name ?? <em>à désigner</em>}</li>
            {p.pilote_agent_profile?.full_name && <li><Users size={14} aria-hidden="true" /> Agent pilote : {p.pilote_agent_profile.full_name}</li>}
            {detail.contributors.length > 0 && (
              <li><Users size={14} aria-hidden="true" /> Participants : {detail.contributors.map((c) => c.full_name ?? "Sans nom").join(", ")}</li>
            )}
            {type === "investissement" && ext.fourchette_estimation && (
              <li>Estimation : {FOURCHETTES.find((f) => f.code === ext.fourchette_estimation)?.label}</li>
            )}
            {type === "investissement" && (
              <li><CalendarDays size={14} aria-hidden="true" /> Échéance : {ext.echeance_souhaitee ? formatEtapeDate(`${ext.echeance_souhaitee}T00:00:00.000Z`) : "pas d'échéance définie"}</li>
            )}
            {type === "evenementiel" && ext.evenement_debut && (
              <li><CalendarDays size={14} aria-hidden="true" /> {formatEtapeDate(ext.evenement_debut)}{ext.evenement_fin ? ` → ${ext.evenement_fin.slice(11, 16)}` : ""}</li>
            )}
            {type === "evenementiel" && ext.lieu && <li><MapPin size={14} aria-hidden="true" /> {ext.lieu}{ext.jauge ? ` · ${ext.jauge} personnes attendues` : ""}</li>}
          </ul>
          {canEdit && !archived && (type === "investissement" || type === "evenementiel") && (
            <ProjectDatesEditor
              projectId={id}
              type={type}
              echeance={ext.echeance_souhaitee ?? null}
              debut={ext.evenement_debut ?? null}
              fin={ext.evenement_fin ?? null}
              lieu={ext.lieu ?? null}
            />
          )}
          {p.description && <p className="pj-life-desc">{p.description}</p>}
          <div className="pj-life-actions">
            {canEdit && !archived && (
              <Link href={`/admin/projects/${id}/edit`} className="civiq-btn civiq-btn-outline civiq-btn-sm">
                <Pencil size={14} aria-hidden="true" /> Modifier
              </Link>
            )}
            {canEdit && !archived && <ProjectTypeChanger projectId={id} currentType={type} canEdit />}
            <Link href={legacyHref} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              <Layers size={14} aria-hidden="true" /> Vue détaillée (ancienne)
            </Link>
          </div>
        </div>

        <div className="pj-life-gauges">
          {type === "evenementiel" && jours !== null ? (
            <div className="pj-countdown" role="timer" aria-live="off">
              <span className="pj-countdown-value">{libelleCompteARebours(jours)}</span>
              <span className="pj-countdown-label">avant l&apos;événement</span>
            </div>
          ) : null}
          <div>
            <Gauge
              label="Avancement"
              pct={avancement.pct}
              hint={avancement.manuel ? `Ajusté : ${p.avancement_manuel_motif ?? ""}` : "Étapes clés terminées"}
            />
            {canEdit && !archived && (
              <AvancementAjuster
                projectId={id}
                manuelPct={p.avancement_manuel_pct ?? null}
                motif={p.avancement_manuel_motif ?? null}
                autoPct={p.avancement_pct ?? null}
              />
            )}
          </div>
          {type !== "suivi_simple" && (
            <Gauge
              label="Budget consommé"
              pct={consommation}
              hint={consommation === null ? "Dès que le budget sera saisi" : `${formatEuros(totaux.engage)} engagés sur ${formatEuros(totaux.prevu)} ${baseBudget === "ht" ? "HT" : "TTC"}`}
              color="var(--success)"
            />
          )}
        </div>
      </header>

      {/* ─── Onglets ─── */}
      {tabs.length > 1 && (
        <nav className="pj-life-tabs" aria-label="Sections du projet">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === tabs[0].key ? `/admin/projects/${id}` : `/admin/projects/${id}?onglet=${t.key}`}
              className={`pj-life-tab${current === t.key ? " is-active" : ""}`}
              aria-current={current === t.key ? "page" : undefined}
              scroll={false}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="civiq-card pj-life-panel">
        {(current === "etapes" || current === "retroplanning") && (
          <EtapesEditor
            projectId={id}
            initial={detail.milestones}
            documents={detail.documents}
            contactsByEtape={detail.milestone_contacts}
            directory={directory}
            canEdit={canEdit && !archived}
            mode={current === "retroplanning" ? "retroplanning" : "etapes"}
          />
        )}

        {current === "partenaires" && (
          <PartiesPrenantesEditor
            projectId={id}
            initial={detail.stakeholders}
            directory={directory}
            canEdit={canEdit && !archived}
            defaultCategorie="citoyenne"
            title="Partenaires"
          />
        )}

        {current === "documents" && (
          <section aria-labelledby="docs-titre">
            <h2 id="docs-titre" className="pj-section-title">Documents</h2>
            <DocumentsEditor projectId={id} initial={detail.documents} canEdit={canEdit && !archived} />
          </section>
        )}

        {current === "devis" && (
          <DevisComparator
            projectId={id}
            initial={devisRows}
            documents={detail.documents.map((d) => ({ id: d.id, nom: d.nom, url: d.url }))}
            entreprises={directory.filter((c) => c.nature === "entreprise" || c.type === "technique")}
            canEdit={canEdit && !archived}
            seuils={seuils}
            parametres={parametresMarches}
            categorieAchat={extC.categorie_achat ?? "travaux"}
            dateConsultation={extC.date_consultation ?? null}
            estimationHt={type === "investissement" ? totaux.prevu : null}
          />
        )}

        {current === "budget" && (
          <>
            <BudgetEditor
              projectId={id}
              mode={type === "evenementiel" ? "evenementiel" : "investissement"}
              initial={budgetRows}
              canEdit={canEdit && !archived}
            />
            {type === "investissement" && (
              <PlanFinancement
                projectId={id}
                serverPlan={serverPlan}
                lignes={budgetRows}
                subventions={subventions}
                tauxFctva={settings.taux_fctva}
                canEdit={canEdit && !archived}
                initial={{
                  emprunt_prevu: extC.emprunt_prevu ?? null,
                  autofinancement_invest: extC.autofinancement_invest ?? null,
                  autofinancement_fonct: extC.autofinancement_fonct ?? null,
                  autofinancement_assume: !!extC.autofinancement_assume,
                  autofinancement_assume_par_nom: assumePar,
                  autofinancement_assume_le: extC.autofinancement_assume_le ?? null,
                }}
              />
            )}
          </>
        )}

        {current === "financeurs" && (
          <>
            <SubventionsEditor projectId={id} initial={subventions} canEdit={canEdit && !archived} />
            <PistesFinancement
              projectId={id}
              aides={pistes.aides}
              locaux={pistes.locaux}
              miseAJour={pistes.miseAJour}
              canEdit={canEdit && !archived}
            />
          </>
        )}
      </div>

      {type === "suivi_simple" && canEdit && !archived && (
        <SuiviActions projectId={id} hasDevis={blocsSupp.includes("devis")} />
      )}
    </main>
  );
}

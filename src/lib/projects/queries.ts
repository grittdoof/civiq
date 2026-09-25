// ═══════════════════════════════════════════════════════════════
// Queries Server-side du module Gestion de projet.
// Toutes filtrent sur commune_id pour l'isolation multi-tenant.
// Lecture via service role (les policies RLS sont déjà strictes,
// mais on garde la même convention que le module tickets).
// ═══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase-server";
import type {
  Commission,
  CommissionMember,
  CommissionSession,
  Financing,
  Milestone,
  Project,
  ProjectDocument,
  ProjectGlobalCost,
  ProjectLifecycleCost,
  ProjectPhase,
  ProjectPhaseLog,
  ProjectStakeholder,
  ProjectSubscriber,
  SessionAttendance,
  SessionDecision,
  Stakeholder,
} from "./types";
import { DEFAULT_PARAMETRES, type CommuneParametres } from "./commune-parametres";

export interface ProjectListFilters {
  /** Inclure les projets archivés (exclus par défaut). */
  includeArchived?: boolean;
  phase?: ProjectPhase | ProjectPhase[];
  piloteUserId?: string;
  search?: string;
  limit?: number;
}

export interface ProjectListItem extends Project {
  pilote_elu_profile?: { id: string; full_name: string | null } | null;
  pilote_agent_profile?: { id: string; full_name: string | null } | null;
  financing_total_demande?: number;
  financing_total_obtenu?: number;
  open_milestones_count?: number;
  late_milestones_count?: number;
  /** Commissions qui suivent ce projet (peuvent être transversales) */
  commissions?: Array<{ id: string; nom: string; color: string; icon: string }>;
}

// Colonnes d'un contact exposées sous la forme historique « Stakeholder »
// (la catégorie de partie prenante s'appelle `type` côté interface).
export const STAKEHOLDER_COLUMNS =
  "id, commune_id, nom, organisation, email, telephone, type:categorie, nature:type, created_at";

// ─── Projets ───

export async function listProjects(
  communeId: string,
  filters: ProjectListFilters = {},
): Promise<ProjectListItem[]> {
  const service = await createServiceClient();

  let q = service
    .from("projects")
    .select(
      `
      *,
      pilote_elu_profile:profiles!projects_pilote_elu_fkey ( id, full_name ),
      pilote_agent_profile:profiles!projects_pilote_agent_fkey ( id, full_name )
    `,
    )
    .is("deleted_at", null)
    .eq("commune_id", communeId)
    .order("date_maj", { ascending: false });

  if (!filters.includeArchived) q = q.is("archived_at", null);
  if (filters.limit) q = q.limit(filters.limit);

  const { data: rows, error } = await q;
  if (error) {
    console.error("[projects] listProjects:", error);
    return [];
  }
  let projects = (rows ?? []) as unknown as ProjectListItem[];

  // Filtres applicatifs (cohérent avec listTickets)
  if (filters.phase) {
    const phases = Array.isArray(filters.phase) ? filters.phase : [filters.phase];
    projects = projects.filter((p) => phases.includes(p.phase));
  }
  if (filters.piloteUserId) {
    projects = projects.filter(
      (p) => p.pilote_elu === filters.piloteUserId || p.pilote_agent === filters.piloteUserId,
    );
  }
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase();
    projects = projects.filter(
      (p) =>
        p.titre.toLowerCase().includes(s) ||
        (p.description ?? "").toLowerCase().includes(s) ||
        (p.objectifs ?? "").toLowerCase().includes(s),
    );
  }

  if (projects.length === 0) return [];

  // Enrichissement : totaux de financement, jalons en retard, commissions
  const ids = projects.map((p) => p.id);
  const [{ data: fins }, { data: jalons }, { data: commLinks }] = await Promise.all([
    service
      .from("financings")
      .select("project_id, montant_demande, montant_obtenu")
      .is("deleted_at", null)
      .in("project_id", ids),
    service
      .from("milestones")
      .select("project_id, fait, echeance")
      .is("deleted_at", null)
      .in("project_id", ids),
    service
      .from("commission_projects")
      .select("project_id, commission:commissions!inner ( id, nom, color, icon )")
      .in("project_id", ids)
      .is("commission.deleted_at", null),
  ]);

  const finByProj = new Map<string, { d: number; o: number }>();
  for (const f of fins ?? []) {
    const cur = finByProj.get(f.project_id) ?? { d: 0, o: 0 };
    cur.d += Number(f.montant_demande ?? 0);
    cur.o += Number(f.montant_obtenu ?? 0);
    finByProj.set(f.project_id, cur);
  }

  const now = new Date();
  const jalByProj = new Map<string, { open: number; late: number }>();
  for (const j of jalons ?? []) {
    const cur = jalByProj.get(j.project_id) ?? { open: 0, late: 0 };
    if (!j.fait) {
      cur.open += 1;
      if (j.echeance && new Date(j.echeance) < now) cur.late += 1;
    }
    jalByProj.set(j.project_id, cur);
  }

  // Commissions par projet (peut être plusieurs / transversales)
  type CommLink = {
    project_id: string;
    commission: { id: string; nom: string; color: string; icon: string } | null;
  };
  const commByProj = new Map<string, NonNullable<ProjectListItem["commissions"]>>();
  for (const r of ((commLinks ?? []) as unknown as CommLink[])) {
    if (!r.commission) continue;
    const arr = commByProj.get(r.project_id) ?? [];
    arr.push({
      id: r.commission.id,
      nom: r.commission.nom,
      color: r.commission.color,
      icon: r.commission.icon,
    });
    commByProj.set(r.project_id, arr);
  }

  for (const p of projects) {
    const f = finByProj.get(p.id);
    p.financing_total_demande = f?.d ?? 0;
    p.financing_total_obtenu = f?.o ?? 0;
    const j = jalByProj.get(p.id);
    p.open_milestones_count = j?.open ?? 0;
    p.late_milestones_count = j?.late ?? 0;
    p.commissions = commByProj.get(p.id) ?? [];
  }

  return projects;
}

export interface ProjectDetail {
  project: ProjectListItem | null;
  stakeholders: Array<ProjectStakeholder & { stakeholder: Stakeholder | null }>;
  financings: Financing[];
  milestones: Milestone[];
  lifecycle: ProjectLifecycleCost[];
  documents: ProjectDocument[];
  subscribers: Array<ProjectSubscriber & { profile: { id: string; full_name: string | null } | null }>;
  phase_log: ProjectPhaseLog[];
  source_ticket: { id: string; numero: number; titre: string } | null;
  global_cost: ProjectGlobalCost | null;
  /** Commissions qui suivent ce projet (peut être plusieurs / transversales) */
  commissions: Array<{
    id: string;
    nom: string;
    color: string;
    icon: string;
    commission_project_id: string;
  }>;
  /** Contributeurs (profils de la commune), lot B. */
  contributors: Array<{ id: string; full_name: string | null; job_title: string | null }>;
  /** Contacts rattachés à chaque étape : milestone_id → contacts. */
  milestone_contacts: Record<string, Stakeholder[]>;
}

export async function getProject(
  communeId: string,
  projectId: string,
): Promise<ProjectDetail> {
  const service = await createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select(
      `
      *,
      pilote_elu_profile:profiles!projects_pilote_elu_fkey ( id, full_name ),
      pilote_agent_profile:profiles!projects_pilote_agent_fkey ( id, full_name )
    `,
    )
    .is("deleted_at", null)
    .eq("commune_id", communeId)
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return {
      project: null,
      stakeholders: [],
      financings: [],
      milestones: [],
      lifecycle: [],
      documents: [],
      subscribers: [],
      phase_log: [],
      source_ticket: null,
      global_cost: null,
      commissions: [],
      contributors: [],
      milestone_contacts: {},
    };
  }

  const [
    stakeholders,
    financings,
    milestones,
    lifecycle,
    documents,
    subscribers,
    phaseLog,
    sourceTicket,
    globalCost,
    commissionsLink,
  ] = await Promise.all([
    service
      .from("project_stakeholders")
      .select(`*, stakeholder:contacts ( ${STAKEHOLDER_COLUMNS} )`)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    service
      .from("financings")
      .select("*")
      .is("deleted_at", null)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    service
      .from("milestones")
      .select("*")
      .is("deleted_at", null)
      .eq("project_id", projectId)
      .order("ordre", { nullsFirst: false })
      .order("date_previsionnelle", { nullsFirst: false }),
    service
      .from("project_lifecycle_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("annee"),
    service
      .from("project_documents")
      .select("*")
      .is("deleted_at", null)
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false }),
    service
      .from("project_subscribers")
      .select("*, profile:profiles ( id, full_name )")
      .eq("project_id", projectId),
    service
      .from("project_phase_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    (project as { source_ticket_id: string | null }).source_ticket_id
      ? service
          .from("tickets")
          .select("id, numero, titre")
          .eq("id", (project as { source_ticket_id: string }).source_ticket_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    service.rpc("project_global_cost", { p_project_id: projectId }),
    service
      .from("commission_projects")
      .select("id, commission:commissions!inner ( id, nom, color, icon )")
      .eq("project_id", projectId)
      .is("commission.deleted_at", null),
  ]);

  // Contributeurs + contacts d'étape + URLs signées fraîches des documents
  // (l'URL stockée à l'upload expire au bout de 7 jours).
  const milestoneIds = ((milestones.data ?? []) as Milestone[]).map((m) => m.id);
  const docRows = (documents.data ?? []) as ProjectDocument[];
  const [contribRes, msContactsRes, signedRes] = await Promise.all([
    service
      .from("project_contributors")
      .select("profile:profiles ( id, full_name, job_title )")
      .eq("project_id", projectId),
    milestoneIds.length
      ? service
          .from("milestone_contacts")
          .select(`milestone_id, contact:contacts!inner ( ${STAKEHOLDER_COLUMNS} )`)
          .in("milestone_id", milestoneIds)
          .is("contact.deleted_at", null)
      : Promise.resolve({ data: [] }),
    docRows.some((d) => d.storage_path)
      ? service.storage
          .from("project-documents")
          .createSignedUrls(docRows.filter((d) => d.storage_path).map((d) => d.storage_path as string), 60 * 60)
      : Promise.resolve({ data: [] }),
  ]);
  const signedByPath = new Map(
    ((signedRes.data ?? []) as Array<{ path: string | null; signedUrl: string }>)
      .filter((x) => x.path)
      .map((x) => [x.path as string, x.signedUrl]),
  );
  const documentsSigned = docRows.map((d) =>
    d.storage_path && signedByPath.get(d.storage_path) ? { ...d, url: signedByPath.get(d.storage_path) as string } : d,
  );
  const contributors = ((contribRes.data ?? []) as unknown as Array<{ profile: ProjectDetail["contributors"][number] | null }>)
    .map((r) => r.profile)
    .filter((x): x is ProjectDetail["contributors"][number] => !!x);
  const milestoneContacts: Record<string, Stakeholder[]> = {};
  for (const r of (msContactsRes.data ?? []) as unknown as Array<{ milestone_id: string; contact: Stakeholder }>) {
    (milestoneContacts[r.milestone_id] ??= []).push(r.contact);
  }

  type CommissionLinkRow = {
    id: string;
    commission: { id: string; nom: string; color: string; icon: string } | null;
  };
  const commissionsList = ((commissionsLink.data ?? []) as unknown as CommissionLinkRow[])
    .filter((r) => r.commission)
    .map((r) => ({
      id: r.commission!.id,
      nom: r.commission!.nom,
      color: r.commission!.color,
      icon: r.commission!.icon,
      commission_project_id: r.id,
    }));

  type GlobalCostRow = {
    invest: number;
    total_nominal: number;
    total_actualise: number;
    taux_inflation_used: number;
    taux_actualisation_used: number;
  };
  const gc = (globalCost.data as GlobalCostRow[] | null)?.[0] ?? null;

  return {
    project: project as unknown as ProjectListItem,
    stakeholders: (stakeholders.data ?? []) as unknown as ProjectDetail["stakeholders"],
    financings: (financings.data ?? []) as Financing[],
    milestones: (milestones.data ?? []) as Milestone[],
    lifecycle: (lifecycle.data ?? []) as ProjectLifecycleCost[],
    documents: documentsSigned,
    subscribers: (subscribers.data ?? []) as unknown as ProjectDetail["subscribers"],
    phase_log: (phaseLog.data ?? []) as ProjectPhaseLog[],
    source_ticket: (sourceTicket.data ?? null) as ProjectDetail["source_ticket"],
    global_cost: gc
      ? {
          invest: Number(gc.invest),
          total_nominal: Number(gc.total_nominal),
          total_actualise: Number(gc.total_actualise),
          taux_inflation_used: Number(gc.taux_inflation_used),
          taux_actualisation_used: Number(gc.taux_actualisation_used),
        }
      : null,
    commissions: commissionsList,
    contributors,
    milestone_contacts: milestoneContacts,
  };
}

// ─── Stakeholders (réutilisables par commune) ───

export async function listStakeholders(communeId: string): Promise<Stakeholder[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("contacts")
    .select(STAKEHOLDER_COLUMNS)
    .eq("commune_id", communeId)
    .is("deleted_at", null)
    .order("nom");
  return (data ?? []) as Stakeholder[];
}

// ─── Paramètres projets de la commune (commune_settings) ───

/** Toujours un objet complet : valeurs par défaut si aucune ligne. */
export async function getCommuneSettings(communeId: string): Promise<CommuneParametres> {
  const service = await createServiceClient();
  const { data } = await service
    .from("commune_settings")
    .select("*")
    .eq("commune_id", communeId)
    .maybeSingle();
  const row = (data ?? {}) as Partial<CommuneParametres>;
  const num = (v: unknown, d: number) => (v === null || v === undefined ? d : Number(v));
  return {
    ...DEFAULT_PARAMETRES,
    ...row,
    commune_id: communeId,
    seuil_delegation_maire_ht:
      row.seuil_delegation_maire_ht === null || row.seuil_delegation_maire_ht === undefined
        ? null
        : Number(row.seuil_delegation_maire_ht),
    nb_devis_exige: num(row.nb_devis_exige, DEFAULT_PARAMETRES.nb_devis_exige),
    seuil_devis_exige_ht: num(row.seuil_devis_exige_ht, DEFAULT_PARAMETRES.seuil_devis_exige_ht),
    taux_fctva: num(row.taux_fctva, DEFAULT_PARAMETRES.taux_fctva),
    taux_inflation: num(row.taux_inflation, DEFAULT_PARAMETRES.taux_inflation),
    taux_actualisation: num(row.taux_actualisation, DEFAULT_PARAMETRES.taux_actualisation),
  };
}

// ─── Commissions ───

export async function listCommissions(communeId: string): Promise<Commission[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("commissions")
    .select("*")
    .is("deleted_at", null)
    .eq("commune_id", communeId)
    .order("nom");
  return (data ?? []) as Commission[];
}

export interface CommissionDetail {
  commission: Commission | null;
  members: Array<CommissionMember & { profile: { id: string; full_name: string | null; job_title: string | null } | null }>;
  projects: Array<{ id: string; project_id: string; project: Pick<Project, "id" | "titre" | "phase"> | null }>;
  upcoming_sessions: CommissionSession[];
  past_sessions: CommissionSession[];
}

export async function getCommission(
  communeId: string,
  commissionId: string,
): Promise<CommissionDetail> {
  const service = await createServiceClient();
  const { data: commission } = await service
    .from("commissions")
    .select("*")
    .is("deleted_at", null)
    .eq("commune_id", communeId)
    .eq("id", commissionId)
    .maybeSingle();

  if (!commission) {
    return { commission: null, members: [], projects: [], upcoming_sessions: [], past_sessions: [] };
  }

  const now = new Date().toISOString();
  const [members, projects, upcoming, past] = await Promise.all([
    service
      .from("commission_members")
      .select("*, profile:profiles ( id, full_name, job_title )")
      .eq("commission_id", commissionId)
      .is("deleted_at", null),
    service
      .from("commission_projects")
      .select("id, project_id, project:projects!inner ( id, titre, phase )")
      .eq("commission_id", commissionId)
      .is("project.deleted_at", null),
    service
      .from("commission_sessions")
      .select("*")
      .is("deleted_at", null)
      .eq("commission_id", commissionId)
      .gte("date_seance", now)
      .order("date_seance"),
    service
      .from("commission_sessions")
      .select("*")
      .is("deleted_at", null)
      .eq("commission_id", commissionId)
      .lt("date_seance", now)
      .order("date_seance", { ascending: false }),
  ]);

  return {
    commission: commission as Commission,
    members: (members.data ?? []) as unknown as CommissionDetail["members"],
    projects: (projects.data ?? []) as unknown as CommissionDetail["projects"],
    upcoming_sessions: (upcoming.data ?? []) as CommissionSession[],
    past_sessions: (past.data ?? []) as CommissionSession[],
  };
}

export interface SessionDocument {
  id: string;
  session_id: string;
  nom: string;
  url: string;
  type: "ordre_du_jour" | "presentation" | "rapport" | "annexe" | "autre";
  uploaded_at: string;
}

export interface SessionDetail {
  session: CommissionSession | null;
  commission: Commission | null;
  attendance: Array<SessionAttendance & { profile: { id: string; full_name: string | null } | null }>;
  decisions: SessionDecision[];
  members: Array<CommissionMember & { profile: { id: string; full_name: string | null } | null }>;
  documents: SessionDocument[];
}

export async function getSession(
  communeId: string,
  sessionId: string,
): Promise<SessionDetail> {
  const service = await createServiceClient();
  const { data: session } = await service
    .from("commission_sessions")
    .select("*, commission:commissions ( * )")
    .is("deleted_at", null)
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return { session: null, commission: null, attendance: [], decisions: [], members: [], documents: [] };
  }

  type SessRow = { commission: Commission | null };
  const commission = (session as unknown as SessRow).commission;
  if (!commission || commission.commune_id !== communeId) {
    return { session: null, commission: null, attendance: [], decisions: [], members: [], documents: [] };
  }

  const [attendance, decisions, members, documents] = await Promise.all([
    service
      .from("session_attendance")
      .select("*, profile:profiles ( id, full_name )")
      .eq("session_id", sessionId),
    service
      .from("session_decisions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at"),
    service
      .from("commission_members")
      .select("*, profile:profiles ( id, full_name )")
      .eq("commission_id", commission.id),
    service
      .from("session_documents")
      .select("*")
      .is("deleted_at", null)
      .eq("session_id", sessionId)
      .order("uploaded_at", { ascending: false }),
  ]);

  // Re-signer les URLs des documents (bucket privé)
  const docsList = (documents.data ?? []) as SessionDocument[];
  const docsSigned = await Promise.all(
    docsList.map(async (d) => {
      const sp = (d as SessionDocument & { storage_path?: string }).storage_path;
      if (sp) {
        const { data: signed } = await service.storage
          .from("project-documents")
          .createSignedUrl(sp, 60 * 60 * 24 * 7);
        return { ...d, url: signed?.signedUrl ?? d.url };
      }
      return d;
    }),
  );

  // Re-signer l'URL du PDF d'émargement signé si présent
  let sessionTyped = session as unknown as CommissionSession;
  if (sessionTyped.signed_attendance_pdf_path) {
    const { data: signedAtt } = await service.storage
      .from("project-documents")
      .createSignedUrl(sessionTyped.signed_attendance_pdf_path, 60 * 60 * 24 * 7);
    if (signedAtt?.signedUrl) {
      sessionTyped = { ...sessionTyped, signed_attendance_pdf_url: signedAtt.signedUrl };
    }
  }

  return {
    session: sessionTyped,
    commission,
    attendance: (attendance.data ?? []) as unknown as SessionDetail["attendance"],
    decisions: (decisions.data ?? []) as SessionDecision[],
    members: (members.data ?? []) as unknown as SessionDetail["members"],
    documents: docsSigned,
  };
}

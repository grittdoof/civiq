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
  CommuneSettings,
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

export interface ProjectListFilters {
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
}

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
    .eq("commune_id", communeId)
    .order("date_maj", { ascending: false });

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

  // Enrichissement : totaux de financement et jalons en retard
  const ids = projects.map((p) => p.id);
  const [{ data: fins }, { data: jalons }] = await Promise.all([
    service
      .from("financings")
      .select("project_id, montant_demande, montant_obtenu")
      .in("project_id", ids),
    service
      .from("milestones")
      .select("project_id, fait, echeance")
      .in("project_id", ids),
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

  for (const p of projects) {
    const f = finByProj.get(p.id);
    p.financing_total_demande = f?.d ?? 0;
    p.financing_total_obtenu = f?.o ?? 0;
    const j = jalByProj.get(p.id);
    p.open_milestones_count = j?.open ?? 0;
    p.late_milestones_count = j?.late ?? 0;
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
  commissions: Array<{ id: string; nom: string; commission_project_id: string }>;
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
      .select("*, stakeholder:stakeholders ( * )")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    service
      .from("financings")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    service
      .from("milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("phase")
      .order("echeance", { nullsFirst: false }),
    service
      .from("project_lifecycle_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("annee"),
    service
      .from("project_documents")
      .select("*")
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
      .select("id, commission:commissions ( id, nom )")
      .eq("project_id", projectId),
  ]);

  type CommissionLinkRow = {
    id: string;
    commission: { id: string; nom: string } | null;
  };
  const commissionsList = ((commissionsLink.data ?? []) as unknown as CommissionLinkRow[])
    .filter((r) => r.commission)
    .map((r) => ({
      id: r.commission!.id,
      nom: r.commission!.nom,
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
    documents: (documents.data ?? []) as ProjectDocument[],
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
  };
}

// ─── Stakeholders (réutilisables par commune) ───

export async function listStakeholders(communeId: string): Promise<Stakeholder[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("stakeholders")
    .select("*")
    .eq("commune_id", communeId)
    .order("nom");
  return (data ?? []) as Stakeholder[];
}

// ─── Commune settings ───

export async function getCommuneSettings(
  communeId: string,
): Promise<CommuneSettings | null> {
  const service = await createServiceClient();
  const { data } = await service
    .from("commune_settings")
    .select("*")
    .eq("commune_id", communeId)
    .maybeSingle();
  return (data ?? null) as CommuneSettings | null;
}

export async function upsertCommuneSettings(
  communeId: string,
  taux_inflation: number,
  taux_actualisation: number,
): Promise<CommuneSettings | null> {
  const service = await createServiceClient();
  const { data } = await service
    .from("commune_settings")
    .upsert({ commune_id: communeId, taux_inflation, taux_actualisation })
    .select()
    .maybeSingle();
  return (data ?? null) as CommuneSettings | null;
}

// ─── Commissions ───

export async function listCommissions(communeId: string): Promise<Commission[]> {
  const service = await createServiceClient();
  const { data } = await service
    .from("commissions")
    .select("*")
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
      .eq("commission_id", commissionId),
    service
      .from("commission_projects")
      .select("id, project_id, project:projects ( id, titre, phase )")
      .eq("commission_id", commissionId),
    service
      .from("commission_sessions")
      .select("*")
      .eq("commission_id", commissionId)
      .gte("date_seance", now)
      .order("date_seance"),
    service
      .from("commission_sessions")
      .select("*")
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

  return {
    session: session as unknown as CommissionSession,
    commission,
    attendance: (attendance.data ?? []) as unknown as SessionDetail["attendance"],
    decisions: (decisions.data ?? []) as SessionDecision[],
    members: (members.data ?? []) as unknown as SessionDetail["members"],
    documents: docsSigned,
  };
}

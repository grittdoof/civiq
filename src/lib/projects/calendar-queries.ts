import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-server";
import {
  construireEvenements,
  restreindreAuProfil,
  type CalendarEvent,
  type CalendarRaw,
} from "./calendar";
import { filtrerProjetsVisibles, type Viewer } from "./confidentialite";

// ═══════════════════════════════════════════════════════════════
// Lecture des dates du calendrier général (serveur, service role).
// Une requête par table, jamais de requête par projet (pas de cascade).
// Projets archivés ou supprimés exclus, les trois types confondus.
// ═══════════════════════════════════════════════════════════════

export type { CalendarEvent };

/** `viewer` : projets confidentiels filtrés selon public.user_voit_projet(). */
export async function chargerCalendrierBrut(service: SupabaseClient, communeId: string, viewer: Viewer | null): Promise<CalendarRaw> {
  const [projs, comms] = await Promise.all([
    service
      .from("projects")
      .select("id, titre, type_code, commission_pilote_id, pilote_elu, pilote_agent, evenement_debut, evenement_fin, lieu, date_maj, confidentiel")
      .eq("commune_id", communeId)
      .is("deleted_at", null)
      .is("archived_at", null),
    service
      .from("commissions")
      .select("id, nom, color, icon, responsable_user_id")
      .eq("commune_id", communeId)
      .is("deleted_at", null),
  ]);
  const projects = await filtrerProjetsVisibles(service, viewer, (projs.data ?? []) as Array<CalendarRaw["projects"][number] & { confidentiel: boolean }>);
  const commissions = (comms.data ?? []) as CalendarRaw["commissions"];
  const projectIds = projects.map((p) => p.id);
  const commissionIds = commissions.map((c) => c.id);
  const none = Promise.resolve({ data: [] as never[] });

  const [ms, sess, fin, contrib, members, profs] = await Promise.all([
    projectIds.length
      ? service
          .from("milestones")
          .select("id, project_id, libelle, statut, fait, echeance, date_previsionnelle, date_reelle, est_un_jalon, responsable_user_id, updated_at")
          .in("project_id", projectIds)
          .is("deleted_at", null)
      : none,
    commissionIds.length
      ? service
          .from("commission_sessions")
          .select("id, commission_id, date_seance, lieu, statut, secretaire_de_seance_user_id, updated_at")
          .in("commission_id", commissionIds)
          .is("deleted_at", null)
      : none,
    projectIds.length
      ? service
          .from("financings")
          .select("id, project_id, financeur, statut, date_demande, date_ar")
          .in("project_id", projectIds)
          .eq("statut", "demandee")
          .is("deleted_at", null)
      : none,
    projectIds.length ? service.from("project_contributors").select("project_id, profile_id").in("project_id", projectIds) : none,
    commissionIds.length
      ? service.from("commission_members").select("commission_id, user_id").in("commission_id", commissionIds).is("deleted_at", null)
      : none,
    service.from("profiles").select("id, full_name").eq("commune_id", communeId),
  ]);

  return {
    projects,
    commissions,
    milestones: (ms.data ?? []) as CalendarRaw["milestones"],
    sessions: (sess.data ?? []) as CalendarRaw["sessions"],
    financings: (fin.data ?? []) as CalendarRaw["financings"],
    contributors: (contrib.data ?? []) as CalendarRaw["contributors"],
    commissionMembers: (members.data ?? []) as CalendarRaw["commissionMembers"],
    profiles: (profs.data ?? []) as CalendarRaw["profiles"],
  };
}

export interface CalendarPageData {
  events: CalendarEvent[];
  commissions: Array<{ id: string; nom: string; color: string | null }>;
  referents: Array<{ id: string; nom: string }>;
}

export async function listCalendarEvents(communeId: string, viewer: Viewer): Promise<CalendarPageData> {
  const service = await createServiceClient();
  const raw = await chargerCalendrierBrut(service, communeId, viewer);
  const events = construireEvenements(raw);
  const referentIds = new Set(raw.projects.map((p) => p.pilote_elu).filter((x): x is string => !!x));
  return {
    events,
    commissions: raw.commissions
      .map((c) => ({ id: c.id, nom: c.nom, color: c.color }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    referents: raw.profiles
      .filter((p) => referentIds.has(p.id))
      .map((p) => ({ id: p.id, nom: p.full_name ?? "Sans nom" }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  };
}

/** Événements destinés à l'agenda externe d'un utilisateur (iCal, Google). */
export async function evenementsPourProfil(
  service: SupabaseClient,
  communeId: string,
  viewer: Viewer,
  perimetre: "tout" | "mes",
): Promise<CalendarEvent[]> {
  const raw = await chargerCalendrierBrut(service, communeId, viewer);
  return construireEvenements(perimetre === "mes" ? restreindreAuProfil(raw, viewer.id) : raw);
}

/**
 * Un lien d'abonnement ne vaut que tant que son titulaire a encore accès
 * au module Projets (même règle que requireModule, sans session).
 */
export async function profilAccesProjets(
  service: SupabaseClient,
  profileId: string,
): Promise<{ ok: true; communeId: string; role: string } | { ok: false }> {
  const { data: profile } = await service.from("profiles").select("role, commune_id").eq("id", profileId).maybeSingle();
  if (!profile?.commune_id || !["admin", "editor", "super_admin"].includes(profile.role as string)) return { ok: false };
  const communeId = profile.commune_id as string;
  if (profile.role === "super_admin") return { ok: true, communeId, role: "super_admin" };
  const [{ data: cm }, { data: override }] = await Promise.all([
    service.from("commune_modules").select("module_id").eq("commune_id", communeId).eq("module_id", "projects").maybeSingle(),
    service.from("profile_module_overrides").select("enabled").eq("profile_id", profileId).eq("module_id", "projects").maybeSingle(),
  ]);
  if (!cm || override?.enabled === false) return { ok: false };
  return { ok: true, communeId, role: profile.role as string };
}

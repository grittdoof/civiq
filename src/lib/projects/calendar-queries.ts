import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Queries pour la page Calendrier — toutes les dates clés du
// module projet (étapes clés + séances + relances subv).
// ═══════════════════════════════════════════════════════════════

export type CalendarEventKind = "milestone" | "session" | "financing_ar_pending";

export interface CalendarEvent {
  id: string;
  date: string;            // ISO
  kind: CalendarEventKind;
  title: string;
  subtitle?: string;
  href: string;
  overdue?: boolean;

  /** Couleur d'affichage (issue de la commission pour session, defaults pour autres) */
  color: string;
  /** Identifiant Lucide pour l'icône (cf. CommissionIcon ou un fallback) */
  icon: string;
  /** Nom de la commission pour l'événement de type session */
  commissionName?: string;
  /** Nom du projet associé (pour milestone & financing) */
  projectName?: string;
}

// Couleurs par défaut pour les événements non rattachés à une commission
const DEFAULT_COLORS: Record<CalendarEventKind, string> = {
  milestone: "#5A8DEE",
  session: "#5A8DEE",          // sera écrasée par la couleur de commission
  financing_ar_pending: "#E74C3C",
};
const DEFAULT_ICONS: Record<CalendarEventKind, string> = {
  milestone: "Flag",
  session: "Gavel",
  financing_ar_pending: "Wallet",
};

export async function listCalendarEvents(communeId: string): Promise<CalendarEvent[]> {
  const service = await createServiceClient();
  const events: CalendarEvent[] = [];
  const now = new Date();

  // ─── Projets de la commune ───
  const { data: projs } = await service
    .from("projects")
    .select("id, titre")
    .eq("commune_id", communeId);
  const projectsById = new Map((projs ?? []).map((p) => [p.id as string, p.titre as string]));

  // ─── Étapes clés ───
  if (projectsById.size > 0) {
    const { data: ms } = await service
      .from("milestones")
      .select("id, project_id, libelle, echeance, fait")
      .in("project_id", [...projectsById.keys()])
      .not("echeance", "is", null);
    for (const m of ms ?? []) {
      const projTitre = projectsById.get(m.project_id as string) ?? "Projet";
      const eche = m.echeance as string;
      const overdue = !m.fait && new Date(eche) < now;
      events.push({
        id: `m-${m.id}`,
        date: eche,
        kind: "milestone",
        title: m.libelle as string,
        subtitle: projTitre,
        projectName: projTitre,
        href: `/admin/projects/${m.project_id}`,
        overdue,
        color: DEFAULT_COLORS.milestone,
        icon: DEFAULT_ICONS.milestone,
      });
    }
  }

  // ─── Commissions (avec color/icon) ───
  const { data: comms } = await service
    .from("commissions")
    .select("id, nom, color, icon")
    .eq("commune_id", communeId);
  type Comm = { id: string; nom: string; color: string; icon: string };
  const commsById = new Map((comms ?? []).map((c) => [c.id as string, c as Comm]));

  // ─── Séances de commission ───
  if (commsById.size > 0) {
    const { data: sess } = await service
      .from("commission_sessions")
      .select("id, commission_id, date_seance, lieu")
      .in("commission_id", [...commsById.keys()]);
    for (const s of sess ?? []) {
      const comm = commsById.get(s.commission_id as string);
      events.push({
        id: `s-${s.id}`,
        date: s.date_seance as string,
        kind: "session",
        // Titre = "Séance" (cf. règle pj-cal-event-title pour les séances)
        title: "Séance",
        // Sous-titre = nom de la commission
        subtitle: comm?.nom ?? "Commission",
        commissionName: comm?.nom,
        href: `/admin/commissions/${s.commission_id}/sessions/${s.id}`,
        color: comm?.color ?? DEFAULT_COLORS.session,
        icon: comm?.icon ?? DEFAULT_ICONS.session,
      });
    }
  }

  // ─── Subventions en attente AR > 30 jours ───
  if (projectsById.size > 0) {
    const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const { data: pending } = await service
      .from("financings")
      .select("id, project_id, financeur, date_demande")
      .in("project_id", [...projectsById.keys()])
      .eq("statut", "demandee")
      .lt("date_demande", cutoff)
      .not("date_demande", "is", null);
    for (const f of pending ?? []) {
      const projTitre = projectsById.get(f.project_id as string) ?? "Projet";
      events.push({
        id: `f-${f.id}`,
        date: f.date_demande as string,
        kind: "financing_ar_pending",
        title: `Relance subvention ${f.financeur}`,
        subtitle: `${projTitre} — accusé de réception non reçu`,
        projectName: projTitre,
        href: `/admin/projects/${f.project_id}`,
        overdue: true,
        color: DEFAULT_COLORS.financing_ar_pending,
        icon: DEFAULT_ICONS.financing_ar_pending,
      });
    }
  }

  // Tri chronologique ASC (la vue chrono fait son propre tri par défaut)
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

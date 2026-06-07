import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Queries pour la page Calendrier — toutes les dates clés du
// module projet (jalons + séances de commission) agrégées et
// triées chronologiquement.
// ═══════════════════════════════════════════════════════════════

export type CalendarEventKind = "milestone" | "session" | "financing_ar_pending";

export interface CalendarEvent {
  date: string;            // ISO
  kind: CalendarEventKind;
  title: string;
  subtitle?: string;
  href: string;
  /** Indique si la date est passée et l'événement non clos */
  overdue?: boolean;
  /** ID stable pour les keys React */
  id: string;
}

export async function listCalendarEvents(communeId: string): Promise<CalendarEvent[]> {
  const service = await createServiceClient();
  const events: CalendarEvent[] = [];
  const now = new Date();

  // 1. Étapes clés (milestones) des projets de la commune
  const { data: projs } = await service
    .from("projects")
    .select("id, titre")
    .eq("commune_id", communeId);
  const projectsById = new Map((projs ?? []).map((p) => [p.id as string, p.titre as string]));

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
        href: `/admin/projects/${m.project_id}`,
        overdue,
      });
    }
  }

  // 2. Séances de commission
  const { data: comms } = await service
    .from("commissions")
    .select("id, nom")
    .eq("commune_id", communeId);
  const commsById = new Map((comms ?? []).map((c) => [c.id as string, c.nom as string]));

  if (commsById.size > 0) {
    const { data: sess } = await service
      .from("commission_sessions")
      .select("id, commission_id, date_seance, lieu, statut")
      .in("commission_id", [...commsById.keys()]);
    for (const s of sess ?? []) {
      const commNom = commsById.get(s.commission_id as string) ?? "Commission";
      events.push({
        id: `s-${s.id}`,
        date: s.date_seance as string,
        kind: "session",
        title: commNom,
        subtitle: s.lieu ? `Séance — ${s.lieu}` : "Séance de commission",
        href: `/admin/commissions/${s.commission_id}/sessions/${s.id}`,
      });
    }
  }

  // 3. Financements en attente d'AR depuis > 30 jours (relance)
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
        href: `/admin/projects/${f.project_id}`,
        overdue: true,
      });
    }
  }

  // Tri chronologique
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

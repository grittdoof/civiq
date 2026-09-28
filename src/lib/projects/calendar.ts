// ═══════════════════════════════════════════════════════════════
// Calendrier général (brief §2.11) — logique pure, partagée par la
// page /admin/calendrier, le flux iCal personnel et la synchronisation
// Google Agenda.
//
// Deux dimensions visuelles à ne pas confondre :
//   • type de projet → fond de l'item + icône + libellé ;
//   • commission     → pastille de couleur en tête d'item.
// La couleur ne porte jamais seule l'information (RGAA) : le type et le
// retard figurent toujours en texte.
//
// Ce qui part dans un agenda externe (iCal, Google) : titres, dates,
// type, commission, élu référent, lieu, lien. Jamais les commentaires ni
// les notes internes.
// ═══════════════════════════════════════════════════════════════

import type { IcsEvent } from "@/lib/calendar/ics";
import { ETAPE_STATUT_META, isEnRetard, statutOf } from "./etapes";
import type { EtapeStatut, TypeProjetCode } from "./types";

export type CalendarEventKind = "etape" | "evenement" | "seance" | "relance";

export interface CalendarCommission {
  id: string;
  nom: string;
  color: string | null;
  icon: string | null;
}

export interface CalendarEvent {
  /** Clé stable : « etape:<uuid> », « seance:<uuid> »… */
  id: string;
  kind: CalendarEventKind;
  /** Date murale ISO (composantes UTC). */
  date: string;
  fin: string | null;
  allDay: boolean;
  title: string;
  projectId: string | null;
  projectName: string | null;
  /** null pour une séance de commission. */
  typeCode: TypeProjetCode | null;
  commission: CalendarCommission | null;
  referentId: string | null;
  referentName: string | null;
  statut: EtapeStatut | null;
  estJalon: boolean;
  /** Pour une étape terminée : la date prévue, si elle diffère de la date réelle. */
  datePrevue: string | null;
  overdue: boolean;
  lieu: string | null;
  href: string;
  updatedAt: string | null;
}

// ─── Données brutes (lues par calendar-queries.ts) ───

export interface RawProject {
  id: string;
  titre: string;
  type_code: string | null;
  commission_pilote_id: string | null;
  pilote_elu: string | null;
  pilote_agent: string | null;
  evenement_debut: string | null;
  evenement_fin: string | null;
  lieu: string | null;
  date_maj: string | null;
}
export interface RawMilestone {
  id: string;
  project_id: string;
  libelle: string;
  statut: EtapeStatut | null;
  fait: boolean | null;
  echeance: string | null;
  date_previsionnelle: string | null;
  date_reelle: string | null;
  est_un_jalon: boolean | null;
  responsable_user_id: string | null;
  updated_at: string | null;
}
export interface RawSession {
  id: string;
  commission_id: string;
  date_seance: string;
  lieu: string | null;
  statut: string | null;
  secretaire_de_seance_user_id: string | null;
  updated_at: string | null;
}
export interface RawFinancing {
  id: string;
  project_id: string;
  financeur: string;
  statut: string;
  date_demande: string | null;
  date_ar: string | null;
}
export interface CalendarRaw {
  projects: RawProject[];
  milestones: RawMilestone[];
  commissions: Array<CalendarCommission & { responsable_user_id?: string | null }>;
  sessions: RawSession[];
  financings: RawFinancing[];
  contributors: Array<{ project_id: string; profile_id: string }>;
  commissionMembers: Array<{ commission_id: string; user_id: string | null }>;
  profiles: Array<{ id: string; full_name: string | null }>;
}

export const DUREE_SEANCE_MIN = 120;
export const RELANCE_AR_JOURS = 21;
export const DAY = 86_400_000;

export const TYPE_LABEL: Record<TypeProjetCode, string> = {
  investissement: "Investissement",
  evenementiel: "Événement",
  suivi_simple: "Suivi simple",
};

/** Classe CSS / token de l'item : type de projet, ou « séance ». */
export function registreVisuel(e: Pick<CalendarEvent, "typeCode">): "investment" | "event" | "tracking" | "session" {
  if (!e.typeCode) return "session";
  return e.typeCode === "investissement" ? "investment" : e.typeCode === "evenementiel" ? "event" : "tracking";
}

/** Libellé de catégorie lisible (légende, texte accessible, agenda externe). */
export function libelleCategorie(e: Pick<CalendarEvent, "typeCode">): string {
  return e.typeCode ? TYPE_LABEL[e.typeCode] : "Séance de commission";
}

/** Minuit UTC = pas d'heure saisie (convention wallClockIso). */
export function estJourneeEntiere(iso: string | null | undefined): boolean {
  return !iso || /T00:00:00(\.000)?Z?$/.test(iso) || iso.length === 10;
}

function asType(v: string | null): TypeProjetCode {
  return v === "investissement" || v === "evenementiel" ? v : "suivi_simple";
}

function toWall(v: string): string {
  return v.length === 10 ? `${v}T00:00:00.000Z` : v;
}

export function construireEvenements(raw: CalendarRaw, now: Date = new Date()): CalendarEvent[] {
  const projets = new Map(raw.projects.map((p) => [p.id, p]));
  const commissions = new Map(raw.commissions.map((c) => [c.id, c]));
  const noms = new Map(raw.profiles.map((p) => [p.id, p.full_name]));
  const today = now.toISOString().slice(0, 10);
  const out: CalendarEvent[] = [];

  const base = (p: RawProject) => {
    const c = p.commission_pilote_id ? commissions.get(p.commission_pilote_id) : null;
    return {
      projectId: p.id,
      projectName: p.titre,
      typeCode: asType(p.type_code),
      commission: c ? { id: c.id, nom: c.nom, color: c.color, icon: c.icon } : null,
      referentId: p.pilote_elu,
      referentName: p.pilote_elu ? noms.get(p.pilote_elu) ?? null : null,
      href: `/admin/projects/${p.id}`,
    };
  };

  // ─── Étapes : date réelle si terminée, sinon date prévisionnelle ───
  for (const m of raw.milestones) {
    const p = projets.get(m.project_id);
    if (!p) continue;
    const like = {
      statut: m.statut ?? undefined,
      fait: !!m.fait,
      echeance: m.echeance,
      date_previsionnelle: m.date_previsionnelle,
    } as Parameters<typeof statutOf>[0];
    const statut = statutOf(like);
    const prevue = m.date_previsionnelle ?? (m.echeance ? toWall(m.echeance) : null);
    const reelle = statut === "termine" && m.date_reelle ? m.date_reelle : null;
    const date = reelle ?? prevue;
    if (!date) continue;
    out.push({
      ...base(p),
      id: `etape:${m.id}`,
      kind: "etape",
      date,
      fin: null,
      allDay: estJourneeEntiere(date),
      title: m.libelle,
      statut,
      estJalon: !!m.est_un_jalon,
      datePrevue: reelle && prevue && prevue.slice(0, 10) !== reelle.slice(0, 10) ? prevue : null,
      overdue: isEnRetard(like, now),
      lieu: null,
      updatedAt: m.updated_at,
    });
  }

  // ─── L'événement lui-même (projets événementiels) ───
  for (const p of raw.projects) {
    if (asType(p.type_code) !== "evenementiel" || !p.evenement_debut) continue;
    out.push({
      ...base(p),
      id: `evenement:${p.id}`,
      kind: "evenement",
      date: p.evenement_debut,
      fin: p.evenement_fin,
      allDay: estJourneeEntiere(p.evenement_debut) && !p.evenement_fin,
      title: p.titre,
      statut: null,
      estJalon: true,
      datePrevue: null,
      overdue: false,
      lieu: p.lieu,
      updatedAt: p.date_maj,
    });
  }

  // ─── Séances de commission ───
  for (const s of raw.sessions) {
    const c = commissions.get(s.commission_id);
    if (!c) continue;
    const debut = new Date(s.date_seance);
    out.push({
      id: `seance:${s.id}`,
      kind: "seance",
      date: s.date_seance,
      fin: Number.isNaN(debut.getTime()) ? null : new Date(debut.getTime() + DUREE_SEANCE_MIN * 60_000).toISOString(),
      allDay: false,
      title: `Séance — ${c.nom}`,
      projectId: null,
      projectName: null,
      typeCode: null,
      commission: { id: c.id, nom: c.nom, color: c.color, icon: c.icon },
      referentId: null,
      referentName: null,
      statut: null,
      estJalon: false,
      datePrevue: null,
      overdue: false,
      lieu: s.lieu,
      href: `/admin/commissions/${s.commission_id}/sessions/${s.id}`,
      updatedAt: s.updated_at,
    });
  }

  // ─── Relances : subvention déposée sans accusé de réception ───
  for (const f of raw.financings) {
    if (f.statut !== "demandee" || f.date_ar || !f.date_demande) continue;
    const p = projets.get(f.project_id);
    if (!p) continue;
    const date = new Date(Date.parse(`${f.date_demande.slice(0, 10)}T00:00:00.000Z`) + RELANCE_AR_JOURS * DAY).toISOString();
    out.push({
      ...base(p),
      id: `relance:${f.id}`,
      kind: "relance",
      date,
      fin: null,
      allDay: true,
      title: `Relancer ${f.financeur} (accusé de réception)`,
      statut: null,
      estJalon: false,
      datePrevue: null,
      overdue: date.slice(0, 10) < today,
      lieu: null,
      updatedAt: null,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "fr"));
}

// ─── Périmètre « mes projets et mes commissions » ───

export function restreindreAuProfil(raw: CalendarRaw, profileId: string): CalendarRaw {
  const mesCommissions = new Set([
    ...raw.commissionMembers.filter((m) => m.user_id === profileId).map((m) => m.commission_id),
    ...raw.commissions.filter((c) => c.responsable_user_id === profileId).map((c) => c.id),
  ]);
  const contribue = new Set(raw.contributors.filter((c) => c.profile_id === profileId).map((c) => c.project_id));
  const responsableEtape = new Set(raw.milestones.filter((m) => m.responsable_user_id === profileId).map((m) => m.project_id));
  const mesProjets = new Set(
    raw.projects
      .filter(
        (p) =>
          p.pilote_elu === profileId ||
          p.pilote_agent === profileId ||
          contribue.has(p.id) ||
          (p.commission_pilote_id && mesCommissions.has(p.commission_pilote_id)),
      )
      .map((p) => p.id),
  );
  return {
    ...raw,
    projects: raw.projects.filter((p) => mesProjets.has(p.id) || responsableEtape.has(p.id)),
    // Projet d'un autre : seules les étapes dont on est responsable.
    milestones: raw.milestones.filter((m) => mesProjets.has(m.project_id) || m.responsable_user_id === profileId),
    sessions: raw.sessions.filter((s) => mesCommissions.has(s.commission_id) || s.secretaire_de_seance_user_id === profileId),
    financings: raw.financings.filter((f) => mesProjets.has(f.project_id)),
  };
}

// ─── Filtres de la page ───

export interface CalendarFilters {
  /** Type de projet, ou « seance ». */
  type?: TypeProjetCode | "seance" | "";
  commissionId?: string;
  /** Statut d'étape, ou « retard ». */
  statut?: EtapeStatut | "retard" | "";
  referentId?: string;
}

export function filtrerEvenements(events: CalendarEvent[], f: CalendarFilters): CalendarEvent[] {
  return events.filter((e) => {
    if (f.type) {
      if (f.type === "seance" ? e.kind !== "seance" : e.typeCode !== f.type) return false;
    }
    if (f.commissionId && e.commission?.id !== f.commissionId) return false;
    if (f.statut) {
      if (e.kind !== "etape") return false;
      if (f.statut === "retard" ? !e.overdue : e.statut !== f.statut) return false;
    }
    if (f.referentId && e.referentId !== f.referentId) return false;
    return true;
  });
}

// ─── Textes ───

/** Texte accessible complet d'un item (lecteurs d'écran, info-bulle). */
export function texteAccessible(e: CalendarEvent): string {
  const parts = [libelleCategorie(e)];
  if (e.kind === "evenement") parts.push("date de l'événement");
  if (e.estJalon && e.kind === "etape") parts.push("jalon");
  parts.push(e.title);
  if (e.projectName && e.kind !== "evenement") parts.push(`projet ${e.projectName}`);
  if (e.commission && e.kind !== "seance") parts.push(`commission ${e.commission.nom}`);
  if (e.statut) parts.push(ETAPE_STATUT_META[e.statut].label.toLowerCase());
  if (e.overdue) parts.push("en retard");
  return parts.join(", ");
}

export function descriptionAgenda(e: CalendarEvent, siteUrl: string): string {
  const l = [`Type : ${libelleCategorie(e)}`];
  if (e.projectName && e.kind !== "evenement") l.push(`Projet : ${e.projectName}`);
  if (e.commission) l.push(`Commission : ${e.commission.nom}`);
  if (e.referentName) l.push(`Élu référent : ${e.referentName}`);
  if (e.statut) l.push(`Statut : ${ETAPE_STATUT_META[e.statut].label}${e.overdue ? " (en retard)" : ""}`);
  l.push("", `Ouvrir dans GoCiviq : ${siteUrl}${e.href}`);
  return l.join("\n");
}

export function titreAgenda(e: CalendarEvent): string {
  const retard = e.overdue ? " (en retard)" : "";
  const fait = e.statut === "termine" ? "✓ " : "";
  if (e.kind === "etape") return `${fait}${e.title} · ${e.projectName ?? ""}${retard}`;
  if (e.kind === "relance") return `${e.title} · ${e.projectName ?? ""}`;
  return e.title;
}

export function versIcs(events: CalendarEvent[], siteUrl: string): IcsEvent[] {
  return events.map((e) => ({
    uid: `${e.id.replace(":", "-")}@gociviq.fr`,
    start: e.date,
    end: e.fin,
    allDay: e.allDay,
    summary: titreAgenda(e),
    description: descriptionAgenda(e, siteUrl),
    location: e.lieu,
    url: `${siteUrl}${e.href}`,
    categories: [libelleCategorie(e), ...(e.commission ? [e.commission.nom] : [])],
    lastModified: e.updatedAt,
  }));
}

/** Fenêtre publiée vers les agendas externes : 12 mois en arrière, tout le futur. */
export function dansFenetreExterne(e: CalendarEvent, now: Date = new Date()): boolean {
  return e.date >= new Date(now.getTime() - 365 * DAY).toISOString();
}

// ─── Liens d'abonnement ───

export function lienWebcal(httpsUrl: string): string {
  return httpsUrl.replace(/^https?:\/\//, "webcal://");
}

/** Ouvre Google Agenda sur « Ajouter cet agenda » avec l'URL du flux. */
export function lienAbonnementGoogle(httpsUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(lienWebcal(httpsUrl))}`;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { TicketCanal, TicketCategorie, TicketPriorite, TicketStatut } from "./types";
import {
  notifyTicketAssigned,
  notifyUrgentUnassigned,
  notifyTicketCommented,
  notifyTicketClosed,
} from "./push";
import { writeAudit } from "@/lib/audit";

// ═══════════════════════════════════════════════════════════════
// Server Actions du module Tickets
// ═══════════════════════════════════════════════════════════════

export interface CreateTicketInput {
  canal: TicketCanal;

  // Demandeur (pour canaux externes)
  demandeur_nom?: string | null;
  demandeur_telephone?: string | null;
  demandeur_email?: string | null;
  demandeur_adresse?: string | null;

  // Contenu
  titre: string;
  description?: string | null;
  categorie: TicketCategorie;
  priorite: TicketPriorite;

  // Localisation
  adresse?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precision_geo?: string | null;

  // Workflow optionnel à la création
  assigne_a?: string | null;
  echeance?: string | null;

  // Photos déjà uploadées dans Storage (storage_path[])
  photo_paths?: string[];
}

export async function createTicket(input: CreateTicketInput): Promise<{ id: string; numero: number }> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Non authentifié");
  if (!ctx.communeId && ctx.role !== "super_admin") {
    throw new Error("Aucune commune attribuée");
  }
  if (!["admin", "editor", "super_admin"].includes(ctx.role || "")) {
    throw new Error("Permissions insuffisantes pour créer un ticket");
  }

  const titre = input.titre?.trim();
  if (!titre) throw new Error("Le titre est requis");

  const service = await createServiceClient();
  const insertPayload: Record<string, unknown> = {
    commune_id: ctx.communeId,
    created_by: ctx.userId,
    canal: input.canal,
    titre,
    description: input.description?.trim() || null,
    categorie: input.categorie,
    priorite: input.priorite,
    adresse: input.adresse?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    precision_geo: input.precision_geo ?? null,
    demandeur_nom: input.demandeur_nom?.trim() || null,
    demandeur_telephone: input.demandeur_telephone?.trim() || null,
    demandeur_email: input.demandeur_email?.trim() || null,
    demandeur_adresse: input.demandeur_adresse?.trim() || null,
    assigne_a: input.assigne_a || null,
    echeance: input.echeance || null,
    statut: input.assigne_a ? "assigne" : "nouveau",
  };
  if (input.assigne_a) {
    insertPayload.assigne_at = new Date().toISOString();
  }

  const { data: created, error } = await service
    .from("tickets")
    .insert(insertPayload)
    .select("id, numero, assigne_a")
    .single();

  if (error || !created) {
    throw new Error(error?.message || "Création du ticket échouée");
  }

  // Insérer les photos
  if (input.photo_paths?.length) {
    const photoRows = input.photo_paths.map((path) => ({
      ticket_id: created.id,
      storage_path: path,
      type: "signalement" as const,
      uploaded_by: ctx.userId,
    }));
    const { error: photoErr } = await service.from("ticket_photos").insert(photoRows);
    if (photoErr) {
      console.error("ticket photos insert:", photoErr);
    }
  }

  // ─── Notifications push ───
  // Si assignation directe à la création → notif au destinataire
  if (created.assigne_a) {
    notifyTicketAssigned({
      ticketId: created.id,
      ticketNumero: created.numero,
      titre: input.titre,
      assignedTo: created.assigne_a,
    }).catch((e) => console.error("[push] notify assigned:", e));
  }
  // Sinon, ticket urgent non assigné → notif à tous les agents techniques
  else if (input.priorite === "urgente" && ctx.communeId) {
    notifyUrgentUnassigned({
      ticketId: created.id,
      ticketNumero: created.numero,
      titre: input.titre,
      communeId: ctx.communeId,
    }).catch((e) => console.error("[push] notify urgent:", e));
  }

  revalidatePath("/admin/tickets");
  return { id: created.id, numero: created.numero };
}

/** Liste les agents potentiels pour assignation (admins + editors avec job_title agent_technique). */
export async function listAssignableAgents(): Promise<
  Array<{ id: string; full_name: string | null; job_title: string | null }>
> {
  const ctx = await getAuthContext();
  if (!ctx?.communeId && ctx?.role !== "super_admin") return [];

  const service = await createServiceClient();
  let q = service
    .from("profiles")
    .select("id, full_name, job_title, role")
    .in("role", ["admin", "editor"]);

  if (ctx.role !== "super_admin") {
    q = q.eq("commune_id", ctx.communeId!);
  }

  const { data } = await q;
  return (data ?? []).map(({ id, full_name, job_title }) => ({ id, full_name, job_title }));
}

/** Server action wrapper pour redirect après création depuis un form. */
export async function createTicketAndRedirect(input: CreateTicketInput) {
  const result = await createTicket(input);
  redirect(`/admin/tickets/${result.id}`);
}

// ═══════════════════════════════════════════════════════════════
// Helpers d'autorisation pour les mutations sur un ticket existant
// ═══════════════════════════════════════════════════════════════

async function authorizeTicketMutation(ticketId: string) {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Non authentifié");

  const service = await createServiceClient();
  const { data: ticket } = await service
    .from("tickets")
    .select("id, commune_id, assigne_a, created_by, statut")
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) throw new Error("Ticket introuvable");

  const isSuperAdmin = ctx.role === "super_admin";
  const isAdmin = ctx.role === "admin";
  const isEditor = ctx.role === "editor";
  const sameCommune = ctx.communeId === ticket.commune_id;
  const isAssignee = ticket.assigne_a === ctx.userId;
  const isCreator = ticket.created_by === ctx.userId;

  if (!isSuperAdmin && !sameCommune) {
    throw new Error("Permissions insuffisantes (commune différente)");
  }
  if (!isSuperAdmin && !isAdmin && !isEditor && !isAssignee && !isCreator) {
    throw new Error("Permissions insuffisantes");
  }

  return { ctx, ticket, service, isSuperAdmin, isAdmin, isEditor, isAssignee };
}

// ═══════════════════════════════════════════════════════════════
// Transition de statut
// ═══════════════════════════════════════════════════════════════

const ALLOWED_TRANSITIONS: Record<TicketStatut, TicketStatut[]> = {
  nouveau: ["assigne", "pris_en_charge", "annule"],
  assigne: ["pris_en_charge", "en_cours", "en_attente", "annule"],
  pris_en_charge: ["en_cours", "en_attente", "resolu", "annule"],
  en_cours: ["en_attente", "resolu", "annule"],
  en_attente: ["en_cours", "resolu", "annule"],
  resolu: ["clos", "en_cours"], // possibilité de réouvrir
  clos: [], // terminal sauf super-admin
  annule: ["nouveau"], // possibilité de désannuler
};

export async function updateTicketStatus(ticketId: string, newStatut: TicketStatut): Promise<void> {
  const { ctx, ticket, service, isSuperAdmin } = await authorizeTicketMutation(ticketId);

  const allowed = ALLOWED_TRANSITIONS[ticket.statut as TicketStatut] ?? [];
  if (!isSuperAdmin && !allowed.includes(newStatut)) {
    throw new Error(`Transition non autorisée : ${ticket.statut} → ${newStatut}`);
  }

  const updates: Record<string, unknown> = { statut: newStatut };
  const now = new Date().toISOString();

  if (newStatut === "pris_en_charge" && !("pris_en_charge_at" in ticket)) {
    updates.pris_en_charge_at = now;
  } else if (newStatut === "pris_en_charge") {
    updates.pris_en_charge_at = now;
  }
  if (newStatut === "resolu") updates.resolu_at = now;
  if (newStatut === "clos") {
    updates.clos_at = now;
    updates.clos_by = ctx.userId;
  }

  // Si on prend en charge mais qu'on n'est pas assigné → s'auto-assigner
  if (newStatut === "pris_en_charge" && !ticket.assigne_a) {
    updates.assigne_a = ctx.userId;
    updates.assigne_at = now;
  }

  const { error } = await service.from("tickets").update(updates).eq("id", ticketId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Suppression définitive (super-admin uniquement)
// ═══════════════════════════════════════════════════════════════

export async function deleteTicketHard(ticketId: string): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Non authentifié");
  if (ctx.role !== "super_admin") {
    throw new Error("Suppression définitive réservée aux super-admins");
  }
  const service = await createServiceClient();
  // Snapshot pour l'audit avant suppression
  const { data: snapshot } = await service
    .from("tickets")
    .select("id, numero, commune_id, titre, statut")
    .eq("id", ticketId)
    .maybeSingle();

  const { error } = await service.from("tickets").delete().eq("id", ticketId);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: "ticket.hard_deleted",
    targetType: "ticket",
    targetId: ticketId,
    communeId: snapshot?.commune_id ?? null,
    metadata: snapshot ? { numero: snapshot.numero, titre: snapshot.titre, statut: snapshot.statut } : undefined,
  });

  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Multi-assignés (V2)
//
// `setTicketAssignees(ticketId, profileIds[])` remplace l'ensemble
// des assignés d'un ticket. Le trigger SQL maintient
// `tickets.assigne_a` = premier de la liste.
// ═══════════════════════════════════════════════════════════════

export async function setTicketAssignees(ticketId: string, profileIds: string[]): Promise<void> {
  const { service, ticket, isSuperAdmin, isAdmin, isEditor } = await authorizeTicketMutation(ticketId);
  if (!isSuperAdmin && !isAdmin && !isEditor) {
    throw new Error("Seuls les éditeurs et administrateurs peuvent assigner un ticket");
  }
  // Récupère assignés actuels
  const { data: existing } = await service
    .from("ticket_assignees")
    .select("profile_id")
    .eq("ticket_id", ticketId);
  const existingIds = new Set((existing ?? []).map((r) => r.profile_id));
  const desired = new Set(profileIds);

  const toAdd = profileIds.filter((id) => !existingIds.has(id));
  const toRemove = Array.from(existingIds).filter((id) => !desired.has(id));

  if (toRemove.length) {
    const { error: dErr } = await service
      .from("ticket_assignees")
      .delete()
      .eq("ticket_id", ticketId)
      .in("profile_id", toRemove);
    if (dErr) throw new Error(dErr.message);
  }
  if (toAdd.length) {
    const ctx = await getAuthContext();
    const { error: iErr } = await service
      .from("ticket_assignees")
      .insert(toAdd.map((profile_id) => ({ ticket_id: ticketId, profile_id, assigned_by: ctx?.userId })));
    if (iErr) throw new Error(iErr.message);
  }

  // Notifications aux nouveaux assignés (sauf l'auteur de la modif)
  const ctx = await getAuthContext();
  const recipients = toAdd.filter((id) => id !== ctx?.userId);
  if (recipients.length) {
    const { data: t } = await service
      .from("tickets")
      .select("titre, numero")
      .eq("id", ticketId)
      .maybeSingle();
    if (t) {
      // notif via push helper (séquentielle pour éviter throttle)
      for (const r of recipients) {
        notifyTicketAssigned({
          ticketId,
          ticketNumero: t.numero,
          titre: t.titre,
          assignedTo: r,
        }).catch((e) => console.error("[push] notify multi-assign:", e));
      }
    }
  }

  void ticket; // (lint)
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Assignation (legacy : un seul assigné)
// ═══════════════════════════════════════════════════════════════

export async function assignTicket(ticketId: string, profileId: string | null): Promise<void> {
  const { service, ticket, isSuperAdmin, isAdmin, isEditor } = await authorizeTicketMutation(ticketId);
  if (!isSuperAdmin && !isAdmin && !isEditor) {
    throw new Error("Seuls les éditeurs et administrateurs peuvent réassigner un ticket");
  }

  const updates: Record<string, unknown> = {
    assigne_a: profileId,
    assigne_at: profileId ? new Date().toISOString() : null,
  };
  // Si on assigne et le ticket est encore "nouveau" → passe en "assigne"
  if (profileId && ticket.statut === "nouveau") {
    updates.statut = "assigne";
  }
  // Si on désassigne et le ticket est "assigne" → repasse en "nouveau"
  if (!profileId && ticket.statut === "assigne") {
    updates.statut = "nouveau";
  }

  const { error } = await service.from("tickets").update(updates).eq("id", ticketId);
  if (error) throw new Error(error.message);

  await writeAudit({
    action: profileId ? "ticket.assigned" : "ticket.unassigned",
    targetType: "ticket",
    targetId: ticketId,
    communeId: ticket.commune_id,
    metadata: { from: ticket.assigne_a, to: profileId },
  });

  // Notif push au nouvel assigné (seulement si nouveau destinataire)
  if (profileId && profileId !== ticket.assigne_a) {
    const { data: t } = await service
      .from("tickets")
      .select("titre, numero")
      .eq("id", ticketId)
      .maybeSingle();
    if (t) {
      notifyTicketAssigned({
        ticketId,
        ticketNumero: t.numero,
        titre: t.titre,
        assignedTo: profileId,
      }).catch((e) => console.error("[push] notify assigned:", e));
    }
  }

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Priorité (modifiable inline depuis le panel)
// ═══════════════════════════════════════════════════════════════

export async function updateTicketPriorite(ticketId: string, priorite: TicketPriorite): Promise<void> {
  const { service, isSuperAdmin, isAdmin, isEditor, isAssignee } = await authorizeTicketMutation(ticketId);
  if (!isSuperAdmin && !isAdmin && !isEditor && !isAssignee) {
    throw new Error("Permissions insuffisantes");
  }
  const { error } = await service.from("tickets").update({ priorite }).eq("id", ticketId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Commentaires
// ═══════════════════════════════════════════════════════════════

export async function addTicketComment(ticketId: string, contenu: string): Promise<void> {
  const text = contenu.trim();
  if (!text) throw new Error("Le commentaire ne peut pas être vide");
  if (text.length > 5000) throw new Error("Commentaire trop long (max 5000 caractères)");

  const { ctx, ticket, service } = await authorizeTicketMutation(ticketId);
  const { error } = await service.from("ticket_commentaires").insert({
    ticket_id: ticketId,
    auteur_id: ctx.userId,
    contenu: text,
    is_systeme: false,
  });
  if (error) throw new Error(error.message);

  // Notif à l'agent assigné si différent de l'auteur du commentaire
  if (ticket.assigne_a && ticket.assigne_a !== ctx.userId) {
    const { data: t } = await service
      .from("tickets")
      .select("numero")
      .eq("id", ticketId)
      .maybeSingle();
    if (t) {
      notifyTicketCommented({
        ticketId,
        ticketNumero: t.numero,
        assignedTo: ticket.assigne_a,
        excerpt: text,
      }).catch((e) => console.error("[push] notify commented:", e));
    }
  }

  revalidatePath(`/admin/tickets/${ticketId}`);
}

// ═══════════════════════════════════════════════════════════════
// Rapport d'intervention (clôture)
// ═══════════════════════════════════════════════════════════════

export interface CloseTicketInput {
  ticketId: string;
  // Workflow simplifié — étape 1 : photo OU document OU « pas nécessaire »
  servicePhotoPaths: string[];
  documentPaths: string[];
  sansPieceJointe: boolean;
  description_intervention?: string | null;
  duree_minutes?: number | null;
  materiaux_utilises?: string | null;
  cout_estime?: number | null;
  necessite_suivi?: boolean;
  notes_suivi?: string | null;
  /** Date ISO de réouverture programmée (si necessite_suivi=true) */
  reopen_at?: string | null;
  /** Mode final : "resolu" (à valider par l'admin) ou "clos" (définitif) */
  finalStatut: "resolu" | "clos";
}

export async function closeTicketWithReport(input: CloseTicketInput): Promise<void> {
  const { ctx, ticket, service, isSuperAdmin, isAdmin, isEditor, isAssignee } = await authorizeTicketMutation(input.ticketId);

  if (!isSuperAdmin && !isAdmin && !isEditor && !isAssignee) {
    throw new Error("Permissions insuffisantes pour clôturer");
  }

  // Validation étape 1 : photo OU document OU « pas nécessaire »
  const hasPhoto = input.servicePhotoPaths.length > 0;
  const hasDoc = input.documentPaths.length > 0;
  if (!hasPhoto && !hasDoc && !input.sansPieceJointe) {
    throw new Error("Joignez une photo, un document, ou cochez « sans pièce jointe »");
  }

  // 1. Upsert du rapport
  const { error: rapportErr } = await service
    .from("ticket_rapports")
    .upsert({
      ticket_id: input.ticketId,
      redige_par: ctx.userId,
      service_fait: true,
      description_intervention: input.description_intervention?.trim() || null,
      duree_minutes: input.duree_minutes ?? null,
      materiaux_utilises: input.materiaux_utilises?.trim() || null,
      cout_estime: input.cout_estime ?? null,
      necessite_suivi: !!input.necessite_suivi,
      notes_suivi: input.notes_suivi?.trim() || null,
      document_paths: input.documentPaths,
      sans_piece_jointe: !!input.sansPieceJointe,
    }, { onConflict: "ticket_id" });
  if (rapportErr) throw new Error(rapportErr.message);

  // 2. Insertion des photos service_fait (si présentes)
  if (hasPhoto) {
    const photoRows = input.servicePhotoPaths.map((path) => ({
      ticket_id: input.ticketId,
      storage_path: path,
      type: "service_fait" as const,
      uploaded_by: ctx.userId,
    }));
    const { error: photoErr } = await service.from("ticket_photos").insert(photoRows);
    if (photoErr) throw new Error(photoErr.message);
  }

  // 3. Transition de statut + réouverture programmée éventuelle
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    statut: input.finalStatut,
    resolu_at: now,
  };
  if (input.finalStatut === "clos") {
    updates.clos_at = now;
    updates.clos_by = ctx.userId;
  }
  if (input.necessite_suivi && input.reopen_at) {
    updates.reopen_at = input.reopen_at;
    updates.reopen_reason = input.notes_suivi?.trim() || null;
    updates.reopened_at = null;       // reset (au cas où déjà rouvert avant)
  } else {
    updates.reopen_at = null;
    updates.reopen_reason = null;
  }
  const { error: tErr } = await service.from("tickets").update(updates).eq("id", input.ticketId);
  if (tErr) throw new Error(tErr.message);

  // Audit : clôture avec rapport
  await writeAudit({
    action: input.finalStatut === "clos" ? "ticket.closed" : "ticket.resolved",
    targetType: "ticket",
    targetId: input.ticketId,
    communeId: ticket.commune_id,
    metadata: {
      duree_minutes: input.duree_minutes ?? null,
      cout_estime: input.cout_estime ?? null,
      necessite_suivi: !!input.necessite_suivi,
      photo_count: input.servicePhotoPaths.length,
    },
  });

  // Notif au créateur du ticket
  const { data: tFull } = await service
    .from("tickets")
    .select("titre, numero, created_by")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (tFull?.created_by) {
    notifyTicketClosed({
      ticketId: input.ticketId,
      ticketNumero: tFull.numero,
      titre: tFull.titre,
      createdBy: tFull.created_by,
    }).catch((e) => console.error("[push] notify closed:", e));
  }

  revalidatePath(`/admin/tickets/${input.ticketId}`);
  revalidatePath("/admin/tickets");
}

"use server";

import { revalidatePath } from "next/cache";
import { BUCKET_DOCUMENTS_RAPPORT, estCheminRapportValide } from "@/lib/tickets/documents-rapport";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { CLOTURE_STATUTS, type TicketCanal, type TicketCategorie, type TicketPriorite, type TicketStatut } from "./types";
import {
  sendTicketNotification,
  notifyTicketAssigned,
  notifyUrgentUnassigned,
  notifyTicketCommented,
  notifyTicketClosed,
} from "./push";
import { writeAudit } from "@/lib/audit";
import { verifierCheminsPhotos } from "./photos";
import {
  assignationAutorisee, droitsSurTicket, estAssigne, estSensible, peutCreer, peutVoirTicket, verifierVisibilite,
  type Confidentialite,
} from "./droits";
import { chargerLiens, chargerSpectateur, journaliserModification, versDroits } from "./droits-server";
import { URGENCE_LABELS, cheminCategorie, estUrgence, type Urgence } from "./categories";
import { listerCategories } from "./categories-server";
import { destinatairesAuto, estPeriscolaire, validerPeriscolaire, type PrecisionsPeriscolaire } from "./periscolaire";

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
  /** Historique : déduit de `categorie_id` par la base si absent. */
  categorie?: TicketCategorie;
  /** Historique : déduit de `urgence` par la base si absent. */
  priorite?: TicketPriorite;
  /** Lot 2 : sous-catégorie (ou catégorie) de la taxonomie de la commune. */
  categorie_id?: string | null;
  urgence?: Urgence;

  // Localisation
  adresse?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precision_geo?: string | null;

  // Workflow optionnel à la création
  assigne_a?: string | null;
  /** Multi-assignation à la création (V2). Si fourni, prime sur assigne_a. */
  assignee_ids?: string[];
  echeance?: string | null;

  // Photos déjà uploadées dans Storage (storage_path[])
  photo_paths?: string[];

  // Lot 1 : service, visibilité et destinataires nommés
  service_id?: string | null;
  confidentialite?: Confidentialite;
  destinataire_ids?: string[];

  // Lot 5 : précisions d'un signalement périscolaire
  periscolaire?: Partial<PrecisionsPeriscolaire> | null;
}

export async function createTicket(input: CreateTicketInput): Promise<{ id: string; numero: number }> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Non authentifié");
  if (!ctx.communeId && ctx.role !== "super_admin") {
    throw new Error("Aucune commune attribuée");
  }
  const spectateur = await chargerSpectateur();
  if (!spectateur || !peutCreer(spectateur)) {
    throw new Error("Permissions insuffisantes pour créer un ticket");
  }

  const titre = input.titre?.trim();
  if (!titre) throw new Error("Le titre est requis");
  // Les photos doivent avoir été déposées dans le dossier de la commune.
  verifierCheminsPhotos(input.photo_paths, ctx.communeId);

  const service = await createServiceClient();

  // Lot 2 : catégorie de la commune ; service par défaut de la catégorie
  // si aucun n'a été choisi (undefined = non renseigné, null = aucun).
  const categorie = input.categorie_id ? await verifierCategorie(service, ctx.communeId, input.categorie_id) : null;

  // Lot 5 : remontée automatique (ex. incident enfant → maire, DGS,
  // secrétaire générale) : ces personnes sont nommées destinataires.
  const remontee = categorie && categorie.arbre.some((c) => c.notifier_fonctions?.length)
    ? destinatairesAuto(categorie.id, categorie.arbre, await profilsCommune(service, ctx.communeId))
    : [];
  const periscolaire = categorie && estPeriscolaire(categorie.id, categorie.arbre)
    ? validerPeriscolaire(input.periscolaire) : null;
  if (periscolaire?.site_id) {
    const { data: site } = await service.from("sites").select("id")
      .eq("id", periscolaire.site_id).eq("commune_id", ctx.communeId!).is("deleted_at", null).maybeSingle();
    if (!site) throw new Error("Site inconnu");
  }

  // Visibilité : restreint / confidentiel exigent un destinataire ; service
  // et destinataires doivent appartenir à la commune.
  const destinataires = [...new Set([...(input.destinataire_ids ?? []), ...remontee].filter(Boolean))];
  const confidentialite = verifierVisibilite(input.confidentialite ?? "standard", destinataires);
  await verifierServiceEtPersonnes(service, ctx.communeId, input.service_id ?? null, destinataires);
  const serviceId = input.service_id === undefined ? (categorie?.serviceDefaut ?? null) : input.service_id;
  if (input.urgence !== undefined && !estUrgence(input.urgence)) throw new Error("Urgence inconnue");

  // Normalisation : si assignee_ids fourni, prime sur assigne_a (legacy mono).
  const multiAssignees = Array.isArray(input.assignee_ids)
    ? input.assignee_ids.filter(Boolean)
    : [];
  const primaryAssignee = multiAssignees.length > 0 ? multiAssignees[0] : (input.assigne_a || null);
  const hasAssignee = !!primaryAssignee;

  const insertPayload: Record<string, unknown> = {
    commune_id: ctx.communeId,
    created_by: ctx.userId,
    canal: input.canal,
    titre,
    description: input.description?.trim() || null,
    ...(categorie ? { categorie_id: categorie.id } : { categorie: input.categorie ?? "autre" }),
    ...(input.urgence ? { urgence: input.urgence } : { priorite: input.priorite ?? "normale" }),
    adresse: input.adresse?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    precision_geo: input.precision_geo ?? null,
    demandeur_nom: input.demandeur_nom?.trim() || null,
    demandeur_telephone: input.demandeur_telephone?.trim() || null,
    demandeur_email: input.demandeur_email?.trim() || null,
    demandeur_adresse: input.demandeur_adresse?.trim() || null,
    assigne_a: primaryAssignee,
    echeance: input.echeance || null,
    statut: hasAssignee ? "assigne" : "nouveau",
    service_id: serviceId || null,
    confidentialite,
  };
  if (hasAssignee) {
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

  // Multi-assignation à la création : enregistrer la liste complète dans ticket_assignees.
  // Le trigger SQL maintiendra tickets.assigne_a = premier de la liste.
  if (multiAssignees.length > 0) {
    const assigneeRows = multiAssignees.map((profile_id) => ({
      ticket_id: created.id,
      profile_id,
      assigned_by: ctx.userId,
    }));
    const { error: assignErr } = await service.from("ticket_assignees").insert(assigneeRows);
    if (assignErr) {
      console.error("ticket_assignees insert:", assignErr);
    }
  }

  if (destinataires.length > 0) {
    const { error: destErr } = await service.from("ticket_destinataires").insert(
      destinataires.map((profile_id) => ({ ticket_id: created.id, profile_id, ajoute_par: ctx.userId })),
    );
    if (destErr) console.error("ticket_destinataires insert:", destErr);
  }
  if (periscolaire) {
    const { error: periErr } = await service.from("ticket_periscolaire").insert({
      ticket_id: created.id,
      ...periscolaire,
      famille_informee_le: periscolaire.famille_informee ? new Date().toISOString().slice(0, 10) : null,
    });
    if (periErr) console.error("ticket_periscolaire insert:", periErr);
  }
  await journaliserModification(
    { id: created.id, numero: created.numero, commune_id: ctx.communeId!, confidentialite },
    "creation", { destinataires: destinataires.length, ...(remontee.length ? { remontee: remontee.length } : {}) },
  );

  // Lot 5 : la direction prévenue tout de suite (hors auteur).
  const aPrevenir = remontee.filter((id) => id !== ctx.userId);
  if (aPrevenir.length > 0) {
    sendTicketNotification({
      profileIds: aPrevenir,
      title: `Signalement #${created.numero} : ${categorie?.libelle ?? "à suivre"}`,
      body: "Ce signalement vous est remonté automatiquement.",
      url: `/admin/tickets/${created.id}`,
      tag: `ticket-${created.id}`,
    }).catch((e) => console.error("[push] remontée:", e));
  }

  // ─── Notifications push ───
  // Si assignation directe à la création → notif à tous les destinataires
  if (created.assigne_a) {
    const recipients = multiAssignees.length > 0 ? multiAssignees : [created.assigne_a];
    for (const r of recipients) {
      notifyTicketAssigned({
        ticketId: created.id,
        ticketNumero: created.numero,
        titre: input.titre,
        assignedTo: r,
        assignedByUserId: ctx.userId,
      }).catch((e) => console.error("[push] notify assigned:", e));
    }
  }
  // Sinon, ticket urgent non assigné → notif à tous les agents techniques
  else if ((input.urgence === "urgente" || input.urgence === "danger_immediat" || input.priorite === "urgente") && ctx.communeId) {
    notifyUrgentUnassigned({
      ticketId: created.id,
      ticketNumero: created.numero,
      titre: input.titre,
      communeId: ctx.communeId,
      adresse: input.adresse ?? null,
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
    .in("role", ["super_admin", "admin", "editor"]);

  if (ctx.role !== "super_admin") {
    // On veut pouvoir assigner aussi les super-admins de la plateforme (ils peuvent
    // ne pas être rattachés à une commune) en plus des membres de la commune courante.
    q = q.or(`commune_id.eq.${ctx.communeId!},role.eq.super_admin`);
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
    .select("id, numero, commune_id, assigne_a, created_by, statut, project_id, service_id, confidentialite")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw new Error("Ticket introuvable");

  // Lot 1 : il faut voir le signalement (matrice, confidentialité,
  // destinataires), puis avoir le droit de l'action demandée.
  const spectateur = await chargerSpectateur();
  const liens = (await chargerLiens(service, [ticket.id])).get(ticket.id)!;
  const pourDroits = versDroits(ticket, liens);
  if (!spectateur || !peutVoirTicket(pourDroits, spectateur)) throw new Error("Ticket introuvable");

  const droits = droitsSurTicket(pourDroits, spectateur);
  const isSuperAdmin = ctx.role === "super_admin";
  const isAssignee = estAssigne(pourDroits, ctx.userId);
  return { ctx, ticket, service, spectateur, pourDroits, liens, droits, isSuperAdmin, isAssignee };
}

function exiger(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

/** La catégorie appartient à la commune et est active (lot 2). */
async function verifierCategorie(
  service: Awaited<ReturnType<typeof createServiceClient>>, communeId: string | null, categorieId: string,
): Promise<{
  id: string; libelle: string; serviceDefaut: string | null;
  /** La catégorie et sa parente : de quoi appliquer les règles du lot 5. */
  arbre: Array<{ id: string; parent_id: string | null; code: string; notifier_fonctions: string[] | null }>;
}> {
  if (!communeId) throw new Error("Aucune commune attribuée");
  const { data: c } = await service
    .from("ticket_categories")
    .select("id, parent_id, code, libelle, actif, service_defaut_id, notifier_fonctions, parent:parent_id ( id, parent_id, code, service_defaut_id, notifier_fonctions )")
    .eq("id", categorieId).eq("commune_id", communeId).is("deleted_at", null).maybeSingle();
  if (!c || !c.actif) throw new Error("Catégorie inconnue");
  const parent = c.parent as unknown as { id: string; parent_id: string | null; code: string; service_defaut_id: string | null; notifier_fonctions: string[] | null } | null;
  const soi = { id: c.id as string, parent_id: c.parent_id as string | null, code: c.code as string, notifier_fonctions: c.notifier_fonctions as string[] | null };
  return {
    id: soi.id, libelle: c.libelle as string,
    serviceDefaut: (c.service_defaut_id as string | null) ?? parent?.service_defaut_id ?? null,
    arbre: parent ? [soi, { id: parent.id, parent_id: parent.parent_id, code: parent.code, notifier_fonctions: parent.notifier_fonctions }] : [soi],
  };
}

/** Comptes de l'équipe de la commune, avec leur fonction (remontée du lot 5). */
async function profilsCommune(
  service: Awaited<ReturnType<typeof createServiceClient>>, communeId: string | null,
): Promise<Array<{ id: string; job_title: string | null; role: string | null }>> {
  if (!communeId) return [];
  const { data } = await service.from("profiles").select("id, job_title, role")
    .eq("commune_id", communeId).in("role", ["admin", "editor"]);
  return (data ?? []) as Array<{ id: string; job_title: string | null; role: string | null }>;
}

/** Le service et les personnes choisies appartiennent à la commune (comptes équipe). */
async function verifierServiceEtPersonnes(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  communeId: string | null,
  serviceId: string | null,
  personnes: string[],
): Promise<void> {
  if (!communeId) throw new Error("Aucune commune attribuée");
  if (serviceId) {
    const { data: svc } = await service
      .from("services").select("id").eq("id", serviceId).eq("commune_id", communeId).is("deleted_at", null).maybeSingle();
    if (!svc) throw new Error("Service inconnu");
  }
  if (personnes.length > 0) {
    const { data: rows } = await service
      .from("profiles").select("id").in("id", personnes).eq("commune_id", communeId).in("role", ["admin", "editor"]);
    if ((rows ?? []).length !== personnes.length) throw new Error("Une personne choisie n'appartient pas à la commune");
  }
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
  converti_en_projet: [], // posé et levé uniquement par la passerelle projet
};

export async function updateTicketStatus(ticketId: string, newStatut: TicketStatut): Promise<void> {
  const { ctx, ticket, service, isSuperAdmin, droits } = await authorizeTicketMutation(ticketId);
  // Droit selon la transition demandée (matrice de la commune)
  const reouverture = (ticket.statut === "resolu" && newStatut === "en_cours")
    || (ticket.statut === "annule" && newStatut === "nouveau");
  if (newStatut === "pris_en_charge") exiger(droits.prendreEnCharge, "Vous ne pouvez pas prendre en charge ce signalement");
  else if (newStatut === "resolu" || newStatut === "clos") exiger(droits.cloturer, "Vous ne pouvez pas clôturer ce signalement");
  else if (reouverture) exiger(droits.rouvrir, "Vous ne pouvez pas rouvrir ce signalement");
  else exiger(droits.modifier, "Vous ne pouvez pas modifier ce signalement");

  // « Converti en projet » n'est jamais posé à la main (même super-admin) :
  // il naît de la création du projet, qui fixe aussi le lien.
  if (newStatut === "converti_en_projet") {
    throw new Error("Pour convertir ce signalement, créez le projet depuis le bouton « Transformer en projet ».");
  }
  if (ticket.statut === "converti_en_projet" && ticket.project_id) {
    throw new Error("Ce signalement est suivi dans un projet : son statut ne se modifie plus ici.");
  }

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
  await journaliserModification(ticket, "statut", { statut: newStatut });

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Réouverture d'un ticket clôturé/annulé
// — repasse en "en_cours" (ou "nouveau" si jamais assigné)
// — efface clos_at, resolu_at, reopen_at
// — journalisation auto via ticket_commentaires (is_systeme)
// ═══════════════════════════════════════════════════════════════

export async function reopenTicket(ticketId: string, reason?: string): Promise<void> {
  const { ctx, ticket, service, isSuperAdmin, droits } =
    await authorizeTicketMutation(ticketId);

  if (!droits.rouvrir) {
    throw new Error("Permissions insuffisantes pour rouvrir ce ticket");
  }

  // Seuls les tickets terminaux peuvent être rouverts
  if (!CLOTURE_STATUTS.includes(ticket.statut as TicketStatut)) {
    throw new Error("Ce ticket n'est pas clôturé.");
  }
  // Converti : rouvrir n'a de sens que si le projet a disparu (purge de la corbeille).
  if (ticket.statut === "converti_en_projet" && ticket.project_id) {
    throw new Error("Ce signalement est suivi dans un projet : rouvrez plutôt une étape du projet.");
  }

  const target: TicketStatut = ticket.assigne_a ? "en_cours" : "nouveau";

  const updates: Record<string, unknown> = {
    statut: target,
    resolu_at: null,
    clos_at: null,
    clos_by: null,
    reopen_at: null,
    reopen_reason: null,
    reopened_at: new Date().toISOString(),
  };

  const { error } = await service.from("tickets").update(updates).eq("id", ticketId);
  if (error) throw new Error(error.message);

  // Entrée système dans le journal
  const fromLabel = ticket.statut;
  const journalText = reason?.trim()
    ? `Ticket rouvert (${fromLabel} → ${target}) — motif : ${reason.trim()}`
    : `Ticket rouvert (${fromLabel} → ${target})`;
  await service.from("ticket_commentaires").insert({
    ticket_id: ticketId,
    auteur_id: ctx.userId,
    contenu: journalText,
    is_systeme: true,
  });

  await writeAudit({
    action: "ticket.reopened",
    targetType: "ticket",
    targetId: ticketId,
    communeId: ticket.commune_id,
    metadata: { from: fromLabel, to: target, reason: reason ?? null },
  });

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
  const { service, ticket, spectateur, pourDroits, liens } = await authorizeTicketMutation(ticketId);
  if (!assignationAutorisee(pourDroits, spectateur!, liens.assignes, profileIds)) {
    throw new Error("Vous ne pouvez pas modifier l'assignation de ce signalement");
  }
  await verifierServiceEtPersonnes(service, ticket.commune_id, null, [...new Set(profileIds)]);
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
          assignedByUserId: ctx?.userId ?? null,
        }).catch((e) => console.error("[push] notify multi-assign:", e));
      }
    }
  }

  await journaliserModification(ticket, "assignation", { ajoutes: toAdd.length, retires: toRemove.length });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Assignation (legacy : un seul assigné)
// ═══════════════════════════════════════════════════════════════

export async function assignTicket(ticketId: string, profileId: string | null): Promise<void> {
  const { ctx, service, ticket, spectateur, pourDroits, liens } = await authorizeTicketMutation(ticketId);
  const actuels = [...new Set([...liens.assignes, ...(ticket.assigne_a ? [ticket.assigne_a] : [])])];
  if (!assignationAutorisee(pourDroits, spectateur!, actuels, profileId ? [profileId] : [])) {
    throw new Error("Vous ne pouvez pas modifier l'assignation de ce signalement");
  }
  if (profileId) await verifierServiceEtPersonnes(service, ticket.commune_id, null, [profileId]);

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
        assignedByUserId: ctx.userId,
      }).catch((e) => console.error("[push] notify assigned:", e));
    }
  }

  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Édition complète d'un ticket — chaque modification est tracée
// automatiquement dans le journal d'activité (ticket_commentaires
// avec is_systeme=true). Ne modifie pas le statut.
// ═══════════════════════════════════════════════════════════════

export interface UpdateTicketInput {
  ticketId: string;
  canal?: TicketCanal;
  titre?: string;
  description?: string | null;
  categorie?: TicketCategorie;
  priorite?: TicketPriorite;
  /** Lot 2 */
  categorie_id?: string;
  urgence?: Urgence;
  transmis_a?: string | null;
  transmis_le?: string | null;
  transmis_reference?: string | null;
  adresse?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  precision_geo?: string | null;
  demandeur_nom?: string | null;
  demandeur_telephone?: string | null;
  demandeur_email?: string | null;
  demandeur_adresse?: string | null;
  echeance?: string | null;
  assignee_ids?: string[];
  /** Storage paths supplémentaires à attacher en photos de signalement. */
  new_photo_paths?: string[];
}

const FIELD_LABELS: Record<string, string> = {
  canal: "Canal",
  titre: "Titre",
  description: "Description",
  categorie: "Catégorie",
  priorite: "Priorité",
  adresse: "Adresse",
  latitude: "Latitude",
  longitude: "Longitude",
  precision_geo: "Précision GPS",
  demandeur_nom: "Nom du demandeur",
  demandeur_telephone: "Téléphone du demandeur",
  demandeur_email: "Email du demandeur",
  demandeur_adresse: "Adresse du demandeur",
  echeance: "Échéance",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toString();
  if (typeof v === "boolean") return v ? "oui" : "non";
  return String(v);
}

function shortText(v: string | null | undefined, max = 60): string {
  if (!v) return "—";
  return v.length > max ? v.slice(0, max) + "…" : v;
}

export async function updateTicket(input: UpdateTicketInput): Promise<void> {
  const { ctx, ticket, service, spectateur, pourDroits, liens, droits } =
    await authorizeTicketMutation(input.ticketId);
  if (!droits.modifier) {
    throw new Error("Permissions insuffisantes pour modifier ce ticket");
  }
  if (input.assignee_ids !== undefined) {
    const voulus = [...new Set(input.assignee_ids)];
    const actuels = new Set(liens.assignes);
    const change = voulus.length !== actuels.size || voulus.some((id) => !actuels.has(id));
    if (change && !assignationAutorisee(pourDroits, spectateur!, liens.assignes, voulus)) {
      throw new Error("Vous ne pouvez pas modifier l'assignation de ce signalement");
    }
    if (change) await verifierServiceEtPersonnes(service, ticket.commune_id, null, voulus);
  }
  verifierCheminsPhotos(input.new_photo_paths, ticket.commune_id);

  // Charge l'état actuel complet pour diffing
  const { data: currentRow } = await service
    .from("tickets")
    .select(
      "canal, titre, description, categorie, priorite, categorie_id, urgence, transmis_a, transmis_le, transmis_reference, adresse, latitude, longitude, precision_geo, demandeur_nom, demandeur_telephone, demandeur_email, demandeur_adresse, echeance",
    )
    .eq("id", input.ticketId)
    .single();
  if (!currentRow) throw new Error("Ticket introuvable");
  const current = currentRow as unknown as Record<string, unknown>;

  // Diff champ par champ
  const updates: Record<string, unknown> = {};
  const journalEntries: string[] = [];

  function applyField(
    key: string,
    newVal: unknown,
    label?: string,
    formatter: (v: unknown) => string = fmt,
  ) {
    if (newVal === undefined) return;
    const oldVal = current[key] ?? null;
    const normalized =
      typeof newVal === "string" ? (newVal.trim() === "" ? null : newVal.trim()) : newVal;
    if (oldVal === normalized) return;
    if (oldVal == null && normalized == null) return;
    updates[key] = normalized;
    journalEntries.push(
      `${label ?? FIELD_LABELS[key] ?? key} : ${formatter(oldVal)} → ${formatter(normalized)}`,
    );
  }

  applyField("canal", input.canal);
  applyField("titre", input.titre, "Titre", (v) => `« ${shortText(v as string)} »`);
  applyField("description", input.description, "Description", (v) =>
    v ? `« ${shortText(v as string, 80)} »` : "—",
  );
  applyField("categorie", input.categorie);
  applyField("priorite", input.priorite);
  // Lot 2 : catégorie de la commune, urgence, transmission
  if (input.categorie_id !== undefined && input.categorie_id !== current.categorie_id) {
    await verifierCategorie(service, ticket.commune_id, input.categorie_id);
    const cats = await listerCategories(service, ticket.commune_id);
    applyField("categorie_id", input.categorie_id, "Catégorie", (v) => cheminCategorie(v as string | null, cats).libelle);
  }
  if (input.urgence !== undefined) {
    if (!estUrgence(input.urgence)) throw new Error("Urgence inconnue");
    applyField("urgence", input.urgence, "Urgence", (v) => (estUrgence(v) ? URGENCE_LABELS[v] : "—"));
  }
  applyField("transmis_a", input.transmis_a, "Transmis à");
  applyField("transmis_le", input.transmis_le, "Transmis le");
  applyField("transmis_reference", input.transmis_reference, "Référence chez le gestionnaire");
  applyField("adresse", input.adresse, "Adresse", (v) => shortText(v as string, 80));
  applyField("latitude", input.latitude);
  applyField("longitude", input.longitude);
  applyField("precision_geo", input.precision_geo);
  applyField("demandeur_nom", input.demandeur_nom);
  applyField("demandeur_telephone", input.demandeur_telephone);
  applyField("demandeur_email", input.demandeur_email);
  applyField("demandeur_adresse", input.demandeur_adresse);
  applyField("echeance", input.echeance);

  // Photos additionnelles
  let photosAdded = 0;
  if (input.new_photo_paths?.length) {
    const photoRows = input.new_photo_paths.map((path) => ({
      ticket_id: input.ticketId,
      storage_path: path,
      type: "signalement" as const,
      uploaded_by: ctx.userId,
    }));
    const { error: pErr } = await service.from("ticket_photos").insert(photoRows);
    if (pErr) throw new Error(pErr.message);
    photosAdded = input.new_photo_paths.length;
    journalEntries.push(
      `${photosAdded} photo${photosAdded > 1 ? "s" : ""} ajoutée${photosAdded > 1 ? "s" : ""}`,
    );
  }

  // Diff assignations
  if (input.assignee_ids !== undefined) {
    const { data: existing } = await service
      .from("ticket_assignees")
      .select("profile_id")
      .eq("ticket_id", input.ticketId);
    const existingIds = new Set((existing ?? []).map((r) => r.profile_id));
    const desired = new Set(input.assignee_ids);
    const toAdd = input.assignee_ids.filter((id) => !existingIds.has(id));
    const toRemove = Array.from(existingIds).filter((id) => !desired.has(id));

    if (toRemove.length) {
      const { error: dErr } = await service
        .from("ticket_assignees")
        .delete()
        .eq("ticket_id", input.ticketId)
        .in("profile_id", toRemove);
      if (dErr) throw new Error(dErr.message);
    }
    if (toAdd.length) {
      const { error: iErr } = await service
        .from("ticket_assignees")
        .insert(
          toAdd.map((profile_id) => ({
            ticket_id: input.ticketId,
            profile_id,
            assigned_by: ctx.userId,
          })),
        );
      if (iErr) throw new Error(iErr.message);
    }

    if (toAdd.length || toRemove.length) {
      // Récupère les noms pour le journal
      const ids = [...toAdd, ...toRemove];
      const { data: profs } = await service
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const nameOf = (id: string) =>
        profs?.find((p) => p.id === id)?.full_name ?? "(sans nom)";
      for (const id of toAdd) journalEntries.push(`Agent assigné : ${nameOf(id)}`);
      for (const id of toRemove) journalEntries.push(`Agent retiré : ${nameOf(id)}`);

      // Met à jour assigne_a = premier de la liste (le trigger SQL le fait
      // peut-être, mais on s'assure côté serveur pour la cohérence).
      const primary = input.assignee_ids[0] ?? null;
      updates.assigne_a = primary;
      updates.assigne_at = primary ? new Date().toISOString() : null;

      // Notifs aux nouveaux assignés (sauf l'auteur de la modif)
      const recipients = toAdd.filter((id) => id !== ctx.userId);
      if (recipients.length) {
        const { data: t } = await service
          .from("tickets")
          .select("titre, numero")
          .eq("id", input.ticketId)
          .maybeSingle();
        if (t) {
          for (const r of recipients) {
            notifyTicketAssigned({
              ticketId: input.ticketId,
              ticketNumero: t.numero,
              titre: t.titre,
              assignedTo: r,
              assignedByUserId: ctx.userId,
            }).catch((e) => console.error("[push] notify multi-assign:", e));
          }
        }
      }
    }
  }

  if (Object.keys(updates).length === 0 && journalEntries.length === 0) {
    // Rien à modifier
    return;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service
      .from("tickets")
      .update(updates)
      .eq("id", input.ticketId);
    if (error) throw new Error(error.message);
  }

  // Écrit les entrées système dans le journal (une par changement)
  if (journalEntries.length > 0) {
    const rows = journalEntries.map((contenu) => ({
      ticket_id: input.ticketId,
      auteur_id: ctx.userId,
      contenu,
      is_systeme: true,
    }));
    const { error: cErr } = await service.from("ticket_commentaires").insert(rows);
    if (cErr) {
      console.error("[updateTicket] journal insert error:", cErr);
    }
  }

  await writeAudit({
    action: "ticket.updated",
    targetType: "ticket",
    targetId: input.ticketId,
    communeId: ticket.commune_id,
    // Signalement restreint ou confidentiel : jamais son contenu dans l'audit
    metadata: estSensible(ticket) ? { nb_changements: journalEntries.length, niveau: ticket.confidentialite } : { changes: journalEntries },
  });

  revalidatePath(`/admin/tickets/${input.ticketId}`);
  revalidatePath("/admin/tickets");
}

// ═══════════════════════════════════════════════════════════════
// Priorité (modifiable inline depuis le panel)
// ═══════════════════════════════════════════════════════════════

export async function updateTicketPriorite(ticketId: string, priorite: TicketPriorite): Promise<void> {
  const { service, droits } = await authorizeTicketMutation(ticketId);
  if (!droits.modifier) {
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

  const { ctx, ticket, service, droits } = await authorizeTicketMutation(ticketId);
  exiger(droits.commenter, "Vous ne pouvez pas commenter ce signalement");
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
      .select("numero, titre")
      .eq("id", ticketId)
      .maybeSingle();
    if (t) {
      notifyTicketCommented({
        ticketId,
        ticketNumero: t.numero,
        titre: t.titre,
        assignedTo: ticket.assigne_a,
        excerpt: text,
        authorUserId: ctx.userId,
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
  const { ctx, ticket, service, droits } = await authorizeTicketMutation(input.ticketId);

  if (!droits.cloturer) {
    throw new Error("Permissions insuffisantes pour clôturer");
  }
  verifierCheminsPhotos(input.servicePhotoPaths, ticket.commune_id);

  // Validation étape 1 : photo OU document OU « pas nécessaire »
  const hasPhoto = input.servicePhotoPaths.length > 0;
  const hasDoc = input.documentPaths.length > 0;
  if (!hasPhoto && !hasDoc && !input.sansPieceJointe) {
    throw new Error("Joignez une photo, un document, ou cochez « sans pièce jointe »");
  }

  // Pièces jointes : uniquement des fichiers déposés par
  // /api/tickets/upload-document sous le préfixe de la commune du
  // signalement, et réellement présents dans le bucket.
  const nouveauxDocs = [...new Set(input.documentPaths)];
  for (const path of nouveauxDocs) {
    if (!estCheminRapportValide(path, ticket.commune_id)) throw new Error("Pièce jointe invalide");
    const { data: info } = await service.storage.from(BUCKET_DOCUMENTS_RAPPORT).info(path);
    if (!info) throw new Error("Une pièce jointe n'a pas été reçue. Déposez-la à nouveau.");
  }
  // Une nouvelle clôture (après réouverture) n'efface pas les pièces
  // de la précédente : ce sont des archives.
  const { data: rapportExistant } = await service
    .from("ticket_rapports").select("document_paths").eq("ticket_id", input.ticketId).maybeSingle();
  const documentPaths = [...new Set([...((rapportExistant?.document_paths as string[] | null) ?? []), ...nouveauxDocs])];

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
      document_paths: documentPaths,
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

// ═══════════════════════════════════════════════════════════════
// Lot 1 — Service et visibilité d'un signalement
// ═══════════════════════════════════════════════════════════════

const NIVEAUX: Record<Confidentialite, string> = {
  standard: "Standard", restreint: "Restreint", confidentiel: "Confidentiel",
};

/** Change le service qui traite le signalement (droit « changer de service »). */
export async function changerServiceTicket(ticketId: string, serviceId: string | null): Promise<void> {
  const { ctx, ticket, service, droits } = await authorizeTicketMutation(ticketId);
  exiger(droits.changer_service, "Vous ne pouvez pas changer le service de ce signalement");
  await verifierServiceEtPersonnes(service, ticket.commune_id, serviceId, []);
  if ((ticket.service_id ?? null) === serviceId) return;

  const noms = new Map<string, string>();
  const ids = [ticket.service_id, serviceId].filter((x): x is string => !!x);
  if (ids.length > 0) {
    const { data } = await service.from("services").select("id, nom").in("id", ids);
    for (const r of data ?? []) noms.set(r.id as string, r.nom as string);
  }
  const avant = ticket.service_id ? noms.get(ticket.service_id) ?? "—" : "Aucun";
  const apres = serviceId ? noms.get(serviceId) ?? "—" : "Aucun";

  const { error } = await service.from("tickets").update({ service_id: serviceId }).eq("id", ticketId);
  if (error) throw new Error(error.message);
  await service.from("ticket_commentaires").insert({
    ticket_id: ticketId, auteur_id: ctx.userId, is_systeme: true,
    contenu: `Service : ${avant} → ${apres}`,
  });
  await journaliserModification(ticket, "service");
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

/**
 * Change le niveau de visibilité et les destinataires nommés (droit
 * « changer la visibilité », toujours accordé au créateur). Restreint
 * et confidentiel exigent au moins un destinataire.
 */
export async function modifierVisibiliteTicket(
  ticketId: string, niveau: Confidentialite, destinataireIds: string[],
): Promise<void> {
  const { ctx, ticket, service, droits, liens } = await authorizeTicketMutation(ticketId);
  exiger(droits.changer_visibilite, "Vous ne pouvez pas changer la visibilité de ce signalement");
  const voulus = [...new Set(destinataireIds.filter(Boolean))];
  const confidentialite = verifierVisibilite(niveau, voulus);
  await verifierServiceEtPersonnes(service, ticket.commune_id, null, voulus);

  const actuels = new Set(liens.destinataires);
  const ajoutes = voulus.filter((id) => !actuels.has(id));
  const retires = liens.destinataires.filter((id) => !voulus.includes(id));
  const avant = (ticket.confidentialite ?? "standard") as Confidentialite;

  if (avant !== confidentialite) {
    const { error } = await service.from("tickets").update({ confidentialite }).eq("id", ticketId);
    if (error) throw new Error(error.message);
  }
  if (retires.length > 0) {
    await service.from("ticket_destinataires").delete().eq("ticket_id", ticketId).in("profile_id", retires);
  }
  if (ajoutes.length > 0) {
    const { error } = await service.from("ticket_destinataires").insert(
      ajoutes.map((profile_id) => ({ ticket_id: ticketId, profile_id, ajoute_par: ctx.userId })),
    );
    if (error) throw new Error(error.message);
  }
  if (avant === confidentialite && ajoutes.length === 0 && retires.length === 0) return;

  const morceaux: string[] = [];
  if (avant !== confidentialite) morceaux.push(`Visibilité : ${NIVEAUX[avant]} → ${NIVEAUX[confidentialite]}`);
  if (ajoutes.length || retires.length) {
    morceaux.push(`destinataires : ${ajoutes.length ? `+${ajoutes.length}` : ""}${ajoutes.length && retires.length ? " " : ""}${retires.length ? `−${retires.length}` : ""}`);
  }
  await service.from("ticket_commentaires").insert({
    ticket_id: ticketId, auteur_id: ctx.userId, is_systeme: true, contenu: morceaux.join(" · "),
  });
  // Journalisé si le signalement est ou devient sensible
  await journaliserModification(
    { ...ticket, confidentialite: avant !== "standard" ? avant : confidentialite },
    "visibilite", { avant, apres: confidentialite, ajoutes: ajoutes.length, retires: retires.length },
  );
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

/**
 * Personnes de la commune pouvant être nommées destinataires (comptes
 * équipe). Réservé à qui peut créer ou voir des signalements.
 */
export async function listerPersonnesCommune(): Promise<Array<{ id: string; full_name: string | null; job_title: string | null }>> {
  const ctx = await getAuthContext();
  if (!ctx?.communeId) return [];
  const service = await createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("commune_id", ctx.communeId)
    .in("role", ["admin", "editor"])
    .order("full_name");
  return (data ?? []) as Array<{ id: string; full_name: string | null; job_title: string | null }>;
}

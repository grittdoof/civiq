import { createServiceClient } from "@/lib/supabase-server";
import { BUCKET_DOCUMENTS_RAPPORT, estCheminRapportValide, nomAffichable } from "./documents-rapport";
import { ouvrirDansNavigateur, urlDocument } from "./pieces";
import { droitsSurTicket, type DroitsTicket, type Spectateur } from "./droits";
import { chargerLiens, filtrerVisibles, versDroits } from "./droits-server";
import type { TicketWithRelations, TicketStatut, TicketPriorite, TicketCategorie, TicketPhoto, TicketCommentaire, TicketRapport } from "./types";

// ═══════════════════════════════════════════════════════════════
// Queries Server-side du module Tickets.
// Toutes filtrent sur commune_id pour l'isolation multi-tenant.
// ═══════════════════════════════════════════════════════════════

export interface ListTicketsFilters {
  statut?: TicketStatut | TicketStatut[];
  priorite?: TicketPriorite;
  categorie?: TicketCategorie;
  assignedToMe?: string;        // user.id pour « Mes tickets »
  search?: string;              // titre / description / numéro
  limit?: number;
}

/**
 * Liste les signalements d'une commune VISIBLES du spectateur (lot 1).
 * Le spectateur est obligatoire : sans lui, aucune ligne n'est rendue.
 */
export async function listTickets(
  communeId: string, filters: ListTicketsFilters, spectateur: Spectateur | null,
): Promise<TicketWithRelations[]> {
  const service = await createServiceClient();

  // Sans limite par défaut : l'ancienne limite de 100 faisait disparaître
  // les plus anciens signalements de la liste et des compteurs.
  let base = service
    .from("tickets")
    .select(`
      *,
      created_by_profile:profiles!tickets_created_by_fkey ( id, full_name, job_title ),
      assignee_profile:profiles!tickets_assigne_a_fkey ( id, full_name, job_title )
    `)
    .eq("commune_id", communeId)
    .order("priorite", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.limit) base = base.limit(filters.limit);
  const { data: lignes } = await base;
  const ticketsBase = await filtrerVisibles(service, (lignes ?? []) as unknown as TicketWithRelations[], spectateur);

  // Photos de signalement des seuls signalements listés (avant : toutes
  // les photos de la plateforme étaient lues puis triées en mémoire).
  const ids = (ticketsBase ?? []).map((t) => t.id as string);
  const { data: photos } = ids.length > 0
    ? await service
      .from("ticket_photos")
      .select("id, ticket_id, storage_path, type, uploaded_by, uploaded_at, legende")
      .eq("type", "signalement")
      .in("ticket_id", ids)
      .order("uploaded_at", { ascending: true })
    : { data: [] as TicketPhoto[] };

  let rows = (ticketsBase ?? []) as unknown as TicketWithRelations[];

  // Pour le filtre "Mes tickets" : on prend en compte l'assigné principal
  // ET la table multi-assignés (V2). Récupéré séparément pour ne pas alourdir
  // la query principale (et rester compatible si la migration 012 n'est pas là).
  let multiAssignedIds: Set<string> | null = null;
  if (filters.assignedToMe) {
    const { data: rels } = await service
      .from("ticket_assignees")
      .select("ticket_id")
      .eq("profile_id", filters.assignedToMe);
    multiAssignedIds = new Set((rels ?? []).map((r) => r.ticket_id as string));
  }

  // Application des filtres en mémoire pour rester simple en V1
  if (filters.statut) {
    const statuses = Array.isArray(filters.statut) ? filters.statut : [filters.statut];
    rows = rows.filter((t) => statuses.includes(t.statut));
  }
  if (filters.priorite) rows = rows.filter((t) => t.priorite === filters.priorite);
  if (filters.categorie) rows = rows.filter((t) => t.categorie === filters.categorie);
  if (filters.assignedToMe) {
    const me = filters.assignedToMe;
    rows = rows.filter((t) => t.assigne_a === me || multiAssignedIds!.has(t.id));
  }
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase();
    const numericNumero = Number(s.replace(/^#/, ""));
    rows = rows.filter((t) => {
      const inText = t.titre.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s);
      const inNumero = Number.isFinite(numericNumero) && t.numero === numericNumero;
      return inText || inNumero;
    });
  }

  // Attache les premières photos de signalement
  const photosByTicket = new Map<string, TicketPhoto[]>();
  for (const p of (photos ?? []) as TicketPhoto[]) {
    const arr = photosByTicket.get(p.ticket_id) ?? [];
    arr.push(p);
    photosByTicket.set(p.ticket_id, arr);
  }
  rows.forEach((t) => {
    t.signalement_photos = photosByTicket.get(t.id) ?? [];
  });

  return rows;
}

export type ProfilCourt = { id: string; full_name: string | null; job_title: string | null };

const AUCUN = { ticket: null, photos: [], commentaires: [], rapport: null, assignees: [], destinataires: [], droits: null };

/**
 * Récupère un signalement complet s'il est VISIBLE du spectateur (lot 1),
 * avec les droits de ce spectateur sur lui. Sinon : `ticket` null.
 */
export async function getTicket(communeId: string, ticketId: string, spectateur: Spectateur | null): Promise<{
  ticket: TicketWithRelations | null;
  photos: TicketPhoto[];
  commentaires: TicketCommentaire[];
  rapport: TicketRapport | null;
  assignees: ProfilCourt[];
  destinataires: ProfilCourt[];
  droits: DroitsTicket | null;
}> {
  const service = await createServiceClient();
  if (!spectateur) return AUCUN;

  // Visibilité d'abord : rien d'autre n'est lu si le signalement est caché.
  const { data: entete } = await service
    .from("tickets")
    .select("id, commune_id, created_by, assigne_a, service_id, confidentialite")
    .eq("id", ticketId)
    .maybeSingle();
  if (!entete || (spectateur.role !== "super_admin" && entete.commune_id !== communeId)) return AUCUN;
  const liens = (await chargerLiens(service, [entete.id])).get(entete.id);
  const droits = droitsSurTicket(versDroits(entete, liens), spectateur);
  if (!droits.voir) return AUCUN;

  const [{ data: ticket }, { data: photos }, { data: commentaires }, { data: rapport }, { data: assigneesRaw }] = await Promise.all([
    service
      .from("tickets")
      .select(`
        *,
        created_by_profile:profiles!tickets_created_by_fkey ( id, full_name, job_title ),
        assignee_profile:profiles!tickets_assigne_a_fkey ( id, full_name, job_title )
      `)
      .eq("id", ticketId)
      .maybeSingle(),
    service
      .from("ticket_photos")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("uploaded_at", { ascending: true }),
    service
      .from("ticket_commentaires")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    service
      .from("ticket_rapports")
      .select("*")
      .eq("ticket_id", ticketId)
      .maybeSingle(),
    // Multi-assignés (table V2). Si la migration 012 n'est pas appliquée,
    // la requête échoue silencieusement → on retombe sur assigne_a.
    service
      .from("ticket_assignees")
      .select("profile_id, profiles:profile_id ( id, full_name, job_title )")
      .eq("ticket_id", ticketId)
      .order("assigned_at", { ascending: true }),
  ]);

  type AssigneeRow = { profile_id: string; profiles: { id: string; full_name: string | null; job_title: string | null } | null };
  const assignees = ((assigneesRaw ?? []) as unknown as AssigneeRow[])
    .map((r) => r.profiles)
    .filter((p): p is { id: string; full_name: string | null; job_title: string | null } => !!p);

  const destIds = liens?.destinataires ?? [];
  const { data: destRows } = destIds.length > 0
    ? await service.from("profiles").select("id, full_name, job_title").in("id", destIds)
    : { data: [] as ProfilCourt[] };

  return {
    ticket: ticket as unknown as TicketWithRelations | null,
    photos: (photos ?? []) as TicketPhoto[],
    commentaires: (commentaires ?? []) as TicketCommentaire[],
    rapport: (rapport ?? null) as TicketRapport | null,
    assignees,
    destinataires: (destRows ?? []) as ProfilCourt[],
    droits,
  };
}

/** Génère une URL signée pour la lecture d'une photo (bucket privé). */
export async function getPhotoSignedUrl(storagePath: string, expiresIn = 60 * 60): Promise<string | null> {
  const service = await createServiceClient();
  const { data } = await service.storage.from("tickets-photos").createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}

/**
 * Pièces jointes du rapport d'intervention, limitées au préfixe de la
 * commune du signalement. Chaque document reçoit l'adresse stable de
 * notre route (droits vérifiés à l'ouverture) ; un fichier absent du
 * stockage n'a pas d'adresse.
 */
export async function getRapportDocuments(
  communeId: string, ticketId: string, paths: string[] | null | undefined,
): Promise<Array<{ path: string; nom: string; url: string | null; telechargement: string; ouvrir: boolean }>> {
  const valides = (paths ?? []).filter((p) => estCheminRapportValide(p, communeId));
  if (valides.length === 0) return [];
  const service = await createServiceClient();
  return Promise.all(valides.map(async (path) => {
    const nom = nomAffichable(path);
    const { data } = await service.storage.from(BUCKET_DOCUMENTS_RAPPORT).exists(path);
    return {
      path,
      nom,
      url: data ? urlDocument(ticketId, path) : null,
      telechargement: urlDocument(ticketId, path, { telecharger: true }),
      ouvrir: ouvrirDansNavigateur(nom),
    };
  }));
}

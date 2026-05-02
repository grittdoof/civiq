import { createServiceClient } from "@/lib/supabase-server";
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

/** Liste les tickets vivants (deleted_at à venir si on ajoute soft-delete) d'une commune. */
export async function listTickets(communeId: string, filters: ListTicketsFilters = {}): Promise<TicketWithRelations[]> {
  const service = await createServiceClient();
  let q = service
    .from("tickets")
    .select(`
      *,
      created_by_profile:profiles!tickets_created_by_fkey ( id, full_name, job_title ),
      assignee_profile:profiles!tickets_assigne_a_fkey ( id, full_name, job_title ),
      photo_count:ticket_photos(count),
      comment_count:ticket_commentaires(count),
      signalement_photos:ticket_photos!inner ( id, ticket_id, storage_path, type, uploaded_by, uploaded_at, legende )
    `)
    .eq("commune_id", communeId)
    .eq("signalement_photos.type", "signalement")
    .order("priorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.statut) {
    if (Array.isArray(filters.statut)) q = q.in("statut", filters.statut);
    else q = q.eq("statut", filters.statut);
  }
  if (filters.priorite) q = q.eq("priorite", filters.priorite);
  if (filters.categorie) q = q.eq("categorie", filters.categorie);
  if (filters.assignedToMe) q = q.eq("assigne_a", filters.assignedToMe);

  if (filters.search?.trim()) {
    const s = filters.search.trim();
    const numericNumero = Number(s.replace(/^#/, ""));
    if (Number.isFinite(numericNumero) && numericNumero > 0) {
      q = q.or(`numero.eq.${numericNumero},titre.ilike.%${s}%,description.ilike.%${s}%`);
    } else {
      q = q.or(`titre.ilike.%${s}%,description.ilike.%${s}%`);
    }
  }

  if (filters.limit) q = q.limit(filters.limit);

  // Fallback : la requête ci-dessus avec inner photos peut exclure les tickets sans photo.
  // On fait donc deux requêtes et on merge — plus prévisible que les jointures complexes.
  const [{ data: ticketsBase }, { data: photos }] = await Promise.all([
    service
      .from("tickets")
      .select(`
        *,
        created_by_profile:profiles!tickets_created_by_fkey ( id, full_name, job_title ),
        assignee_profile:profiles!tickets_assigne_a_fkey ( id, full_name, job_title )
      `)
      .eq("commune_id", communeId)
      .order("priorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(filters.limit ?? 100),
    service
      .from("ticket_photos")
      .select("id, ticket_id, storage_path, type, uploaded_by, uploaded_at, legende")
      .eq("type", "signalement"),
  ]);

  let rows = (ticketsBase ?? []) as unknown as TicketWithRelations[];

  // Application des filtres en mémoire pour rester simple en V1
  if (filters.statut) {
    const statuses = Array.isArray(filters.statut) ? filters.statut : [filters.statut];
    rows = rows.filter((t) => statuses.includes(t.statut));
  }
  if (filters.priorite) rows = rows.filter((t) => t.priorite === filters.priorite);
  if (filters.categorie) rows = rows.filter((t) => t.categorie === filters.categorie);
  if (filters.assignedToMe) rows = rows.filter((t) => t.assigne_a === filters.assignedToMe);
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

/** Récupère un ticket complet avec ses relations. */
export async function getTicket(communeId: string, ticketId: string): Promise<{
  ticket: TicketWithRelations | null;
  photos: TicketPhoto[];
  commentaires: TicketCommentaire[];
  rapport: TicketRapport | null;
}> {
  const service = await createServiceClient();

  const [{ data: ticket }, { data: photos }, { data: commentaires }, { data: rapport }] = await Promise.all([
    service
      .from("tickets")
      .select(`
        *,
        created_by_profile:profiles!tickets_created_by_fkey ( id, full_name, job_title ),
        assignee_profile:profiles!tickets_assigne_a_fkey ( id, full_name, job_title )
      `)
      .eq("commune_id", communeId)
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
  ]);

  return {
    ticket: ticket as unknown as TicketWithRelations | null,
    photos: (photos ?? []) as TicketPhoto[],
    commentaires: (commentaires ?? []) as TicketCommentaire[],
    rapport: (rapport ?? null) as TicketRapport | null,
  };
}

/** Génère une URL signée pour la lecture d'une photo (bucket privé). */
export async function getPhotoSignedUrl(storagePath: string, expiresIn = 60 * 60): Promise<string | null> {
  const service = await createServiceClient();
  const { data } = await service.storage.from("tickets-photos").createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl ?? null;
}

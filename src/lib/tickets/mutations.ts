"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { TicketCanal, TicketCategorie, TicketPriorite } from "./types";

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
    .select("id, numero")
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

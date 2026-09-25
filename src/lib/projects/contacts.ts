// ═══════════════════════════════════════════════════════════════
// Annuaire unique des contacts (migration 039).
// Parties prenantes, financeurs, entreprises, associations et membres
// externes de commission sont tous des lignes de `contacts`.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StakeholderType } from "./types";

export type ContactType = "personne" | "entreprise" | "collectivite" | "financeur" | "association";

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  personne: "Personne",
  entreprise: "Entreprise",
  collectivite: "Collectivité",
  financeur: "Financeur",
  association: "Association",
};

/** Nature du contact déduite de sa catégorie de partie prenante. */
export function contactTypeFromCategorie(categorie: StakeholderType | null | undefined): ContactType {
  switch (categorie) {
    case "financeur": return "financeur";
    case "institutionnelle": return "collectivite";
    case "technique": return "entreprise";
    default: return "personne";
  }
}

/** Email normalisé pour le dédoublonnage (null si vide). */
export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/**
 * Retrouve un contact de la commune par email (insensible à la casse)
 * ou le crée. Utilisé à chaque saisie de personne externe : une même
 * personne n'existe qu'une fois dans l'annuaire.
 */
export async function findOrCreateContact(
  service: SupabaseClient,
  input: {
    communeId: string;
    nom: string;
    email?: string | null;
    telephone?: string | null;
    organisation?: string | null;
    categorie?: StakeholderType | null;
    type?: ContactType;
    source: "saisie" | "commission_member" | "project_tiers" | "ticket";
    createdBy?: string | null;
  },
): Promise<{ id: string } | null> {
  const email = normalizeEmail(input.email);
  if (email) {
    const { data: existing } = await service
      .from("contacts")
      .select("id")
      .eq("commune_id", input.communeId)
      .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) return existing as { id: string };
  }
  const { data } = await service
    .from("contacts")
    .insert({
      commune_id: input.communeId,
      nom: input.nom.trim(),
      email: input.email?.trim() || null,
      telephone: input.telephone?.trim() || null,
      organisation: input.organisation?.trim() || null,
      categorie: input.categorie ?? null,
      type: input.type ?? contactTypeFromCategorie(input.categorie),
      source: input.source,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  return (data as { id: string } | null) ?? null;
}

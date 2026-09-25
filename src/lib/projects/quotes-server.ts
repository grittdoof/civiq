// ═══════════════════════════════════════════════════════════════
// Devis — règles serveur partagées par POST et PATCH.
//   • l'entreprise est rattachée à l'annuaire unique (contacts) ;
//   • un seul devis retenu par lot : retenir un devis écarte les autres ;
//   • les références (contact, document) appartiennent à la commune / au projet.
// ═══════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateContact } from "./contacts";
import type { QuoteFields } from "./money-validation";

export async function resolveQuoteRefs(
  service: SupabaseClient,
  projectId: string,
  communeId: string,
  userId: string,
  f: QuoteFields,
): Promise<{ ok: true; fields: QuoteFields } | { ok: false; error: string }> {
  const fields = { ...f };
  if (fields.contact_id) {
    const { data } = await service
      .from("contacts").select("id, nom").eq("id", fields.contact_id).eq("commune_id", communeId).is("deleted_at", null).maybeSingle();
    if (!data) return { ok: false, error: "Entreprise introuvable dans l'annuaire." };
    if (!fields.prestataire) fields.prestataire = data.nom as string;
  } else if (fields.prestataire && fields.contact_id === undefined) {
    const c = await findOrCreateContact(service, {
      communeId, nom: fields.prestataire, type: "entreprise", categorie: "technique", source: "saisie", createdBy: userId,
    });
    if (c) fields.contact_id = c.id;
  }
  if (fields.document_id) {
    const { data } = await service
      .from("project_documents").select("id").eq("id", fields.document_id).eq("project_id", projectId).is("deleted_at", null).maybeSingle();
    if (!data) return { ok: false, error: "Document introuvable." };
  }
  return { ok: true, fields };
}

/** Retenir un devis : les autres devis retenus du même lot deviennent « non retenus ». */
export async function releaseOtherRetained(service: SupabaseClient, projectId: string, quoteId: string | null, lot: string | null) {
  let q = service
    .from("project_quotes")
    .update({ statut: "non_retenu" })
    .eq("project_id", projectId)
    .eq("statut", "retenu")
    .is("deleted_at", null);
  q = lot ? q.eq("lot", lot) : q.is("lot", null);
  if (quoteId) q = q.neq("id", quoteId);
  await q;
}

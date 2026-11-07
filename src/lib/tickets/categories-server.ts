import { createServiceClient } from "@/lib/supabase-server";
import type { CategorieTicket } from "./categories";

// Catégories d'une commune (lot 2), toutes ou actives seulement.

type Service = Awaited<ReturnType<typeof createServiceClient>>;

export const COLONNES_CATEGORIE =
  "id, parent_id, code, libelle, icone, ordre, actif, service_defaut_id, urgence_defaut, confidentialite_defaut, delai_cible_heures, gestionnaire_externe, consigne_urgence";

export async function listerCategories(
  service: Service, communeId: string, { actifsSeulement = false } = {},
): Promise<CategorieTicket[]> {
  let q = service
    .from("ticket_categories")
    .select(COLONNES_CATEGORIE)
    .eq("commune_id", communeId)
    .is("deleted_at", null);
  if (actifsSeulement) q = q.eq("actif", true);
  const { data } = await q.order("ordre").order("libelle");
  return (data ?? []) as CategorieTicket[];
}

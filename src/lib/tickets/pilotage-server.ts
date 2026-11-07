import { createServiceClient } from "@/lib/supabase-server";
import { peutVoirTicket, type Spectateur } from "./droits";
import { chargerLiens, versDroits } from "./droits-server";
import { listerCategories } from "./categories-server";
import type { CategorieTicket, Urgence } from "./categories";
import type { TicketPilotage } from "./pilotage";

// ═══════════════════════════════════════════════════════════════
// Données du pilotage (lot 4), dans la portée de la personne :
//   • confidentiels exclus ;
//   • restreints qu'elle ne peut pas ouvrir mais qui seraient dans sa
//     portée s'ils étaient standard : gardés, marqués `masque` (comptés,
//     jamais listés).
// ═══════════════════════════════════════════════════════════════

export interface TicketPilotageDetail extends TicketPilotage {
  titre: string;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  priorite: string;
  categorie: string;
}

export interface DonneesPilotage {
  tickets: TicketPilotageDetail[];
  categories: CategorieTicket[];
  services: Array<{ id: string; nom: string }>;
}

export async function chargerPilotage(communeId: string, s: Spectateur): Promise<DonneesPilotage> {
  const service = await createServiceClient();
  const [{ data }, categories, { data: services }] = await Promise.all([
    service
      .from("tickets")
      .select("id, numero, titre, statut, urgence, priorite, categorie, created_at, pris_en_charge_at, clos_at, resolu_at, delai_cible_le, service_id, categorie_id, commune_id, created_by, assigne_a, confidentialite, adresse, latitude, longitude")
      .eq("commune_id", communeId)
      .neq("confidentialite", "confidentiel"),
    listerCategories(service, communeId),
    service.from("services").select("id, nom").eq("commune_id", communeId).is("deleted_at", null).order("ordre").order("nom"),
  ]);
  const lignes = data ?? [];
  const liens = await chargerLiens(service, lignes.map((t) => t.id as string));
  const racineDe = new Map(categories.map((c) => [c.id, c.parent_id ?? c.id]));

  const tickets: TicketPilotageDetail[] = [];
  for (const t of lignes) {
    const droits = versDroits(t as never, liens.get(t.id as string));
    const visible = peutVoirTicket(droits, s);
    const dansPortee = visible || (droits.confidentialite === "restreint" && peutVoirTicket({ ...droits, confidentialite: "standard" }, s));
    if (!dansPortee) continue;
    tickets.push({
      id: t.id as string, numero: t.numero as number, titre: visible ? (t.titre as string) : "",
      statut: t.statut as string, urgence: ((t.urgence as Urgence | null) ?? "normale"),
      created_at: t.created_at as string, pris_en_charge_at: t.pris_en_charge_at as string | null,
      clos_at: t.clos_at as string | null, resolu_at: t.resolu_at as string | null,
      delai_cible_le: t.delai_cible_le as string | null, service_id: t.service_id as string | null,
      categorie_id: t.categorie_id as string | null,
      categorie_racine_id: t.categorie_id ? racineDe.get(t.categorie_id as string) ?? null : null,
      masque: !visible,
      adresse: visible ? (t.adresse as string | null) : null,
      latitude: visible ? (t.latitude as number | null) : null,
      longitude: visible ? (t.longitude as number | null) : null,
      priorite: t.priorite as string, categorie: t.categorie as string,
    });
  }
  return { tickets, categories, services: (services ?? []) as Array<{ id: string; nom: string }> };
}

export interface FiltresPilotage { serviceId?: string; categorieRacineId?: string; urgence?: Urgence }

export function filtrer(tickets: TicketPilotageDetail[], f: FiltresPilotage): TicketPilotageDetail[] {
  return tickets.filter((t) =>
    (!f.serviceId || (f.serviceId === "aucun" ? !t.service_id : t.service_id === f.serviceId))
    && (!f.categorieRacineId || t.categorie_racine_id === f.categorieRacineId)
    && (!f.urgence || t.urgence === f.urgence));
}

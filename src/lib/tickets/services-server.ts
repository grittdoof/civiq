import { NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Services de la commune (lot 1) : lecture et contrôle d'accès
// partagés par la page des paramètres et ses routes API.
// Gestion réservée à l'administrateur de la commune et au super-admin.
// ═══════════════════════════════════════════════════════════════

type Service = Awaited<ReturnType<typeof createServiceClient>>;

export interface ServiceCommune {
  id: string;
  nom: string;
  ordre: number;
  membres: string[];
}

export async function gardeGestionServices(): Promise<
  { ok: true; communeId: string; userId: string; service: Service } | { ok: false; response: NextResponse }
> {
  const garde = await requireModule("tickets");
  if (!garde.ok) return garde;
  if (garde.role !== "admin" && garde.role !== "super_admin") {
    return { ok: false, response: NextResponse.json({ error: "Réservé à l'administrateur de la commune" }, { status: 403 }) };
  }
  if (!garde.communeId) {
    return { ok: false, response: NextResponse.json({ error: "Aucune commune rattachée" }, { status: 403 }) };
  }
  return { ok: true, communeId: garde.communeId, userId: garde.userId, service: await createServiceClient() };
}

export async function listerServices(service: Service, communeId: string): Promise<ServiceCommune[]> {
  const { data: services } = await service
    .from("services")
    .select("id, nom, ordre")
    .eq("commune_id", communeId)
    .is("deleted_at", null)
    .order("ordre")
    .order("nom");
  const ids = (services ?? []).map((s) => s.id as string);
  const { data: membres } = ids.length > 0
    ? await service.from("service_membres").select("service_id, profile_id").in("service_id", ids)
    : { data: [] as Array<{ service_id: string; profile_id: string }> };
  return (services ?? []).map((s) => ({
    id: s.id as string,
    nom: s.nom as string,
    ordre: s.ordre as number,
    membres: (membres ?? []).filter((m) => m.service_id === s.id).map((m) => m.profile_id as string),
  }));
}

export async function listerEquipe(service: Service, communeId: string) {
  const { data } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("commune_id", communeId)
    .in("role", ["admin", "editor"])
    .order("full_name");
  return (data ?? []) as Array<{ id: string; full_name: string | null; job_title: string | null }>;
}

/** Nom de service : 2 à 80 caractères. */
export function nomServiceValide(nom: unknown): string | null {
  if (typeof nom !== "string") return null;
  const n = nom.trim().replace(/\s+/g, " ");
  return n.length >= 2 && n.length <= 80 ? n : null;
}

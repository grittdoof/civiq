import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { joursRestants } from "@/lib/projects/corbeille";

// GET /api/super-admin/corbeille — projets mis à la corbeille (toutes communes).

export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from("projects")
    .select("id, titre, type_code, confidentiel, deleted_at, deleted_by, suppression_motif, commune:communes ( name )")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as unknown as Array<{ id: string; titre: string; type_code: string | null; confidentiel: boolean; deleted_at: string; deleted_by: string | null; suppression_motif: string | null; commune: { name: string } | null }>;
  const auteurs = [...new Set(rows.map((r) => r.deleted_by).filter((x): x is string => !!x))];
  const { data: profs } = auteurs.length ? await service.from("profiles").select("id, full_name").in("id", auteurs) : { data: [] };
  const nom = new Map((profs ?? []).map((p) => [p.id as string, p.full_name as string | null]));
  return NextResponse.json({
    projets: rows.map((r) => ({
      id: r.id,
      titre: r.titre,
      type_code: r.type_code,
      confidentiel: r.confidentiel,
      commune: r.commune?.name ?? "—",
      supprime_le: r.deleted_at,
      supprime_par: r.deleted_by ? nom.get(r.deleted_by) ?? "—" : "—",
      motif: r.suppression_motif,
      jours_restants: joursRestants(r.deleted_at),
    })),
  });
}

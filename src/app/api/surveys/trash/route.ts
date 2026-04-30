import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// GET /api/surveys/trash — sondages soft-deleted de la commune
// Réservé aux admins (et super-admins)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.commune_id || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { data, error } = await service
    .from("surveys")
    .select("id, title, slug, status, deleted_at, deleted_by")
    .eq("commune_id", profile.commune_id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

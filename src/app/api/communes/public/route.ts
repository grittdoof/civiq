import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/communes/public — liste légère des communes non-archivées
// Utilisée par /admin/onboarding pour permettre une demande de rattachement.
export async function GET() {
  const service = await createServiceClient();
  const { data, error } = await service
    .from("communes")
    .select("id, name, slug, code_postal, archived_at")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Exclure les archivées sans accès direct au champ
  const live = (data ?? []).filter((c) => !(c as { archived_at?: string }).archived_at);
  return NextResponse.json(live.map(({ id, name, slug, code_postal }) => ({ id, name, slug, code_postal })));
}

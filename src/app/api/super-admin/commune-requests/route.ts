import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/commune-requests — liste les demandes (par défaut: pending)
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  const service = await createServiceClient();
  const { data: requests, error } = await service
    .from("commune_requests")
    .select(`
      id, user_id, request_type, commune_id,
      proposed_name, proposed_code_postal, proposed_email, requested_role,
      message, status, rejection_reason, created_at, reviewed_at,
      communes(name, slug),
      profiles(full_name, job_title)
    `)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrichir avec les emails (auth.users)
  const { data: { users: authUsers } } = await service.auth.admin.listUsers();
  const enriched = (requests ?? []).map((r) => {
    const u = authUsers?.find((a) => a.id === r.user_id);
    return { ...r, email: u?.email ?? null };
  });

  return NextResponse.json(enriched);
}

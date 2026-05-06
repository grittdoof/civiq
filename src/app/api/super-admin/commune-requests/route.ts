import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// ═══════════════════════════════════════════════════════════════
// GET /api/super-admin/commune-requests
//
// Liste les demandes de rattachement, par défaut celles en attente.
//
// Note technique : on ne peut pas joindre `profiles` directement via
// `select()` embedded car commune_requests.user_id référence
// auth.users(id), pas public.profiles(id) — la relation implicite
// n'est pas détectée par PostgREST. On fait donc deux requêtes et
// on enrichit côté Node.
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  const service = await createServiceClient();

  // 1. Demandes + commune visée (jointure FK directe sur commune_id)
  const { data: requests, error } = await service
    .from("commune_requests")
    .select(`
      id, user_id, request_type, commune_id,
      proposed_name, proposed_code_postal, proposed_email, requested_role,
      message, status, rejection_reason, created_at, reviewed_at,
      communes(name, slug)
    `)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[commune-requests] select error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json([]);
  }

  // 2. Profiles correspondants (nom, fonction)
  const userIds = Array.from(new Set(requests.map((r) => r.user_id)));
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .in("id", userIds);
  const profileMap = new Map<string, { full_name: string | null; job_title: string | null }>(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, job_title: p.job_title }])
  );

  // 3. Emails depuis auth.users (en best-effort : ne bloque pas si listUsers échoue)
  let authUsers: { id: string; email?: string }[] = [];
  try {
    const res = await service.auth.admin.listUsers();
    authUsers = res.data?.users ?? [];
  } catch (e) {
    console.error("[commune-requests] listUsers error:", e);
  }
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? null] as const));

  const enriched = requests.map((r) => ({
    ...r,
    email: emailMap.get(r.user_id) ?? null,
    profiles: profileMap.get(r.user_id) ?? { full_name: null, job_title: null },
  }));

  return NextResponse.json(enriched);
}

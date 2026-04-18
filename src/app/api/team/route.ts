import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isCommuneAdmin } from "@/lib/auth-helpers";

// GET /api/team — membres + invitations en attente pour la commune courante
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.communeId) {
    return NextResponse.json({ error: "Aucune commune associée" }, { status: 403 });
  }

  const service = await createServiceClient();

  // Membres de la commune
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("commune_id", ctx.communeId);

  // Emails depuis auth.users
  const { data: { users: authUsers } } = await service.auth.admin.listUsers();

  const members = (profiles ?? []).map((p) => {
    const u = authUsers?.find((au) => au.id === p.id);
    return {
      ...p,
      email: u?.email ?? null,
      last_sign_in_at: u?.last_sign_in_at ?? null,
      is_self: p.id === ctx.userId,
    };
  });

  // Invitations en attente
  const { data: invitations } = await service
    .from("commune_invitations")
    .select("id, email, role, message, created_at, expires_at, accepted_at")
    .eq("commune_id", ctx.communeId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ members, invitations: invitations ?? [] });
}

// DELETE /api/team?member_id=xxx — retirer un membre
export async function DELETE(request: Request) {
  const ctx = await getAuthContext();
  if (!isCommuneAdmin(ctx)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const url = new URL(request.url);
  const memberId = url.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "member_id requis" }, { status: 400 });
  if (memberId === ctx!.userId) {
    return NextResponse.json({ error: "Impossible de se retirer soi-même" }, { status: 400 });
  }

  const service = await createServiceClient();
  // On retire la commune_id (pas le profil entier)
  const { error } = await service
    .from("profiles")
    .update({ commune_id: null, role: "viewer" })
    .eq("id", memberId)
    .eq("commune_id", ctx!.communeId!);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isCommuneAdmin } from "@/lib/auth-helpers";

// POST /api/team/invite — invite un nouvel utilisateur dans la commune
export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!isCommuneAdmin(ctx)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { email, role = "editor", message } = await request.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Vérifier si l'email est déjà membre de cette commune
  const { data: { users: authUsers } } = await service.auth.admin.listUsers();
  const existingUser = authUsers?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    const { data: existingProfile } = await service
      .from("profiles")
      .select("commune_id")
      .eq("id", existingUser.id)
      .single();

    if (existingProfile?.commune_id === ctx!.communeId) {
      return NextResponse.json({ error: "Cet utilisateur est déjà membre" }, { status: 409 });
    }
  }

  // Créer l'invitation
  const { data: invitation, error } = await service
    .from("commune_invitations")
    .insert({
      commune_id: ctx!.communeId,
      email: email.toLowerCase().trim(),
      role,
      message: message ?? null,
      invited_by: ctx!.userId,
    })
    .select("id, token, email, role, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // TODO: envoyer un email d'invitation (à brancher avec Resend/Postmark)
  // Pour l'instant, on retourne le lien pour copy-paste
  const inviteUrl = `${request.headers.get("origin") ?? ""}/auth/invitation/${invitation.token}`;

  return NextResponse.json({ ...invitation, invite_url: inviteUrl }, { status: 201 });
}

// DELETE — révoquer une invitation
export async function DELETE(request: Request) {
  const ctx = await getAuthContext();
  if (!isCommuneAdmin(ctx)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const url = new URL(request.url);
  const invitationId = url.searchParams.get("id");
  if (!invitationId) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from("commune_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("commune_id", ctx!.communeId!);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

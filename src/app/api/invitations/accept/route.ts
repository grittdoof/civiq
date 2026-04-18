import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// GET /api/invitations/accept?token=xxx — détails de l'invitation (preview)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token requis" }, { status: 400 });

  const service = await createServiceClient();
  const { data: invitation } = await service
    .from("commune_invitations")
    .select("id, email, role, message, accepted_at, expires_at, communes(id, name, slug, primary_color)")
    .eq("token", token)
    .single();

  if (!invitation) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  if (invitation.accepted_at) {
    return NextResponse.json({ error: "Invitation déjà acceptée" }, { status: 410 });
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });
  }

  return NextResponse.json(invitation);
}

// POST — accepter (utilisateur connecté)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vous devez être connecté pour accepter" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token requis" }, { status: 400 });

  const service = await createServiceClient();
  const { data: invitation } = await service
    .from("commune_invitations")
    .select("id, email, role, commune_id, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (!invitation) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  if (invitation.accepted_at) {
    return NextResponse.json({ error: "Invitation déjà acceptée" }, { status: 410 });
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invitation expirée" }, { status: 410 });
  }
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: `Cette invitation est pour ${invitation.email}, mais vous êtes connecté en tant que ${user.email}` },
      { status: 403 }
    );
  }

  // Upsert profile : associer à la commune avec le rôle
  await service.from("profiles").upsert({
    id: user.id,
    commune_id: invitation.commune_id,
    role: invitation.role,
  });

  // Marquer l'invitation acceptée
  await service
    .from("commune_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ success: true, commune_id: invitation.commune_id });
}

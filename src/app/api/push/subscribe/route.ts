import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// POST /api/push/subscribe
//   Body: { endpoint, keys: { p256dh, auth }, userAgent? }
//
// Enregistre (ou met à jour) la souscription pour le profil
// authentifié.
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("push_subscriptions")
    .upsert(
      {
        profile_id: user.id,
        endpoint: body.endpoint,
        p256dh_key: body.keys.p256dh,
        auth_key: body.keys.auth,
        user_agent: body.userAgent ?? request.headers.get("user-agent") ?? null,
      },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

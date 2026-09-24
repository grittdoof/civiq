import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// POST /api/convocations/:token — réponse publique à une convocation
//   body : { status: "accepted" | "declined", comment?: string }
//
// Pas d'authentification : le jeton (192 bits, personnel, reçu par
// email) fait office de preuve. Fonctionne donc pour les membres
// externes sans compte. La réponse reste modifiable jusqu'à la séance.

interface RouteParams { params: Promise<{ token: string }>; }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!token || token.length < 20 || token.length > 64) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  let body: { status?: string; comment?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (body.status !== "accepted" && body.status !== "declined") {
    return NextResponse.json({ error: "Réponse invalide" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: conv } = await service
    .from("session_convocations")
    .select("id, session:commission_sessions ( date_seance, compte_rendu_valide )")
    .eq("token", token)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

  const session = (conv as unknown as { session: { compte_rendu_valide: boolean } | null }).session;
  if (session?.compte_rendu_valide) {
    return NextResponse.json({ error: "Cette séance est clôturée." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error } = await service
    .from("session_convocations")
    .update({
      status: body.status,
      response_comment: body.comment?.trim().slice(0, 500) || null,
      responded_at: now,
      updated_at: now,
    })
    .eq("id", conv.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: body.status });
}

import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { sanitizeRichText } from "@/lib/projects/rich-text";
import { sendSessionConvocations, type SendConvocationsResult } from "@/lib/projects/convocation-send";

// POST /api/commissions/:id/sessions
// Crée une séance puis, si `send_convocation` est vrai (validé par
// l'utilisateur dans le formulaire), envoie la convocation email + push
// à tous les membres — y compris les externes sans compte.
//
// L'envoi est fait DANS la requête (et non en fire-and-forget après la
// réponse : sur Vercel, la fonction est gelée dès la réponse envoyée et
// les emails partaient ou non au hasard). Le rapport d'envoi est
// renvoyé au client.

export const maxDuration = 60;

interface RouteParams { params: Promise<{ id: string }>; }

interface CreateBody {
  date_seance?: string;
  lieu?: string | null;
  ordre_du_jour?: string | null;
  secretaire_de_seance_user_id?: string | null;
  send_convocation?: boolean;
  /** Sous-ensemble de commission_members.id ; absent = tous */
  convocation_member_ids?: string[] | null;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  if (!["admin", "editor", "super_admin"].includes(guard.role)) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }

  const { id } = await params;
  let body: CreateBody = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!body.date_seance) return NextResponse.json({ error: "date_seance requise" }, { status: 400 });

  const service = await createServiceClient();
  // Vérif ownership commission
  const { data: commission } = await service
    .from("commissions")
    .select("id, nom, commune_id")
    .is("deleted_at", null)
    .eq("id", id)
    .maybeSingle();
  if (!commission || commission.commune_id !== guard.communeId) {
    return NextResponse.json({ error: "Commission introuvable" }, { status: 404 });
  }

  const { data: session, error } = await service
    .from("commission_sessions")
    .insert({
      commission_id: id,
      date_seance: body.date_seance,
      lieu: body.lieu?.trim() || null,
      ordre_du_jour: body.ordre_du_jour ? sanitizeRichText(body.ordre_du_jour.trim()) || null : null,
      secretaire_de_seance_user_id: body.secretaire_de_seance_user_id || null,
    })
    .select("*")
    .single();
  if (error || !session) return NextResponse.json({ error: error?.message ?? "Erreur" }, { status: 500 });

  // Convocation (échec d'envoi ≠ échec de création : la séance existe,
  // l'envoi peut être relancé depuis la page de la séance)
  let convocation: SendConvocationsResult | null = null;
  let convocationError: string | null = null;
  if (body.send_convocation) {
    try {
      convocation = await sendSessionConvocations({
        service,
        sessionId: session.id,
        memberIds: body.convocation_member_ids ?? null,
      });
    } catch (e) {
      console.error("[convocation] envoi à la création:", e);
      convocationError = e instanceof Error ? e.message : "Erreur d'envoi";
    }
  }

  await writeAudit({
    action: "commission.session.created",
    targetType: "commission",
    targetId: id,
    communeId: guard.communeId,
    metadata: {
      session_id: session.id,
      date: body.date_seance,
      convocations_sent: convocation?.sent.length ?? 0,
    },
  });

  return NextResponse.json({ session, convocation, convocation_error: convocationError });
}

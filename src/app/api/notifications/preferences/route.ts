import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { smsEnabled } from "@/lib/notifications/sms";

// ═══════════════════════════════════════════════════════════════
// /api/notifications/preferences
//
// GET    : préférences du profil courant (auto-init si absentes)
// PATCH  : mise à jour (push_enabled, sms_enabled, sms_phone,
//          notify_assignment, notify_urgent_unassigned,
//          notify_comment, notify_closure)
// ═══════════════════════════════════════════════════════════════

const FIELDS = [
  "push_enabled", "sms_enabled", "sms_phone",
  "notify_assignment", "notify_urgent_unassigned",
  "notify_comment", "notify_closure",
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from("notification_preferences")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    // Init par défaut
    const { data: created } = await service
      .from("notification_preferences")
      .insert({ profile_id: user.id })
      .select()
      .single();
    return NextResponse.json({ ...created, sms_available: smsEnabled() });
  }
  return NextResponse.json({ ...data, sms_available: smsEnabled() });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if (key in body) updates[key] = body[key];
  }
  if ("sms_phone" in updates && typeof updates.sms_phone === "string") {
    const v = (updates.sms_phone as string).trim();
    updates.sms_phone = v || null;
  }

  // Validation simple : sms_enabled implique sms_phone non null
  if (updates.sms_enabled === true) {
    const { data: existing } = await (await createServiceClient())
      .from("notification_preferences")
      .select("sms_phone")
      .eq("profile_id", user.id)
      .maybeSingle();
    const finalPhone = (updates.sms_phone as string | null | undefined) ?? existing?.sms_phone;
    if (!finalPhone) {
      return NextResponse.json({ error: "Renseignez d'abord un numéro de téléphone pour activer le SMS" }, { status: 400 });
    }
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("notification_preferences")
    .upsert({ profile_id: user.id, ...updates });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

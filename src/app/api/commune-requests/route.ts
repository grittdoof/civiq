import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// API publique de demande de rattachement à une commune
//
// GET    : statut de la demande en cours (pour l'utilisateur)
// POST   : créer une demande (join ou create)
// DELETE : annuler sa propre demande pendante
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const service = await createServiceClient();
  const { data } = await service
    .from("commune_requests")
    .select("id, request_type, commune_id, proposed_name, requested_role, status, created_at, rejection_reason, communes(name, slug)")
    .eq("user_id", user.id)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const { request_type, commune_id, proposed_name, proposed_code_postal, proposed_email, message } = body;

  if (!["join", "create"].includes(request_type)) {
    return NextResponse.json({ error: "request_type invalide" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Une seule demande pendante par user
  const { data: existing } = await service
    .from("commune_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Une demande est déjà en cours d'examen. Annulez-la avant d'en créer une nouvelle." },
      { status: 409 }
    );
  }

  // Si déjà rattaché, on refuse
  const { data: profile } = await service
    .from("profiles")
    .select("commune_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.commune_id) {
    return NextResponse.json({ error: "Vous êtes déjà rattaché à une commune." }, { status: 409 });
  }

  const insert: Record<string, unknown> = {
    user_id: user.id,
    request_type,
    message: message?.trim() || null,
  };

  if (request_type === "join") {
    if (!commune_id) {
      return NextResponse.json({ error: "Sélectionnez une commune" }, { status: 400 });
    }
    insert.commune_id = commune_id;
    insert.requested_role = "editor";
  } else {
    if (!proposed_name?.trim()) {
      return NextResponse.json({ error: "Le nom de la commune est requis" }, { status: 400 });
    }
    insert.proposed_name = proposed_name.trim();
    insert.proposed_code_postal = proposed_code_postal?.trim() || null;
    insert.proposed_email = proposed_email?.trim() || user.email || null;
    insert.requested_role = "admin";
  }

  const { data: created, error } = await service
    .from("commune_requests")
    .insert(insert)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: created.id });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const service = await createServiceClient();
  // Sécurité : on n'autorise la suppression que si pending et appartient au user
  const { error } = await service
    .from("commune_requests")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

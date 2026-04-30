import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function slugify(s: string): string {
  return s.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// POST /api/super-admin/commune-requests/[id]
//   body: { action: "approve" | "reject", role?, rejection_reason? }
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const { action, role, rejection_reason } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action invalide" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: req, error: reqErr } = await service
    .from("commune_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (reqErr || !req) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Demande déjà traitée" }, { status: 409 });
  }

  // ─── Refus ───
  if (action === "reject") {
    const { error } = await service
      .from("commune_requests")
      .update({
        status: "rejected",
        rejection_reason: rejection_reason?.trim() || "Demande non retenue.",
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx!.userId,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Approbation ───
  let communeId = req.commune_id as string | null;
  const finalRole = role || req.requested_role || "editor";

  if (req.request_type === "create") {
    // Crée la commune
    const baseSlug = slugify(req.proposed_name || "commune");
    let slug = baseSlug || `commune-${Date.now()}`;
    // Vérifier l'unicité
    const { data: clash } = await service.from("communes").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: newCommune, error: cErr } = await service
      .from("communes")
      .insert({
        name: req.proposed_name,
        slug,
        code_postal: req.proposed_code_postal || null,
        contact_email: req.proposed_email || null,
        primary_color: "#1a2744",
        accent_color: "#c9a84c",
      })
      .select("id")
      .single();

    if (cErr || !newCommune) {
      return NextResponse.json({ error: cErr?.message || "Création commune échouée" }, { status: 500 });
    }
    communeId = newCommune.id;

    // Active le module surveys par défaut
    await service.from("commune_modules").insert({
      commune_id: communeId,
      module_id: "surveys",
      activated_by: ctx!.userId,
    });
  }

  if (!communeId) {
    return NextResponse.json({ error: "commune_id manquant" }, { status: 400 });
  }

  // Met à jour le profil de l'utilisateur
  const { error: pErr } = await service
    .from("profiles")
    .update({
      commune_id: communeId,
      role: finalRole,
    })
    .eq("id", req.user_id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  // Marque la demande comme approved
  const { error: rErr } = await service
    .from("commune_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: ctx!.userId,
      commune_id: communeId,
    })
    .eq("id", id);
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  return NextResponse.json({ success: true, commune_id: communeId, role: finalRole });
}

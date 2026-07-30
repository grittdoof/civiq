import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";
import { sendEmail, getSiteUrl } from "@/lib/email";
import {
  buildApprovalEmail,
  buildRejectionEmail,
  type CommuneContact,
} from "@/lib/emails/commune-decision";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Récupère l'email (auth.users) et le nom (profiles) du demandeur.
async function getRecipient(
  service: SupabaseClient,
  userId: string,
): Promise<{ email: string | null; fullName: string | null }> {
  let email: string | null = null;
  try {
    const { data } = await service.auth.admin.getUserById(userId);
    email = data.user?.email ?? null;
  } catch (e) {
    console.error("[commune-requests] getUserById error:", e);
  }
  const { data: profile } = await service
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return { email, fullName: profile?.full_name ?? null };
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
  // Modules à activer pour la commune (sélectionnés par le super-admin).
  const modules: string[] = Array.isArray(body.modules)
    ? body.modules.filter((m: unknown): m is string => typeof m === "string")
    : [];

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
    const reason = rejection_reason?.trim() || "Demande non retenue.";
    const { error } = await service
      .from("commune_requests")
      .update({
        status: "rejected",
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx!.userId,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Email de refus (best-effort, ne bloque jamais la réponse)
    const { email, fullName } = await getRecipient(service, req.user_id);
    if (email) {
      // Cas « join » : on joint les coordonnées de la mairie visée.
      let commune: CommuneContact | null = null;
      let communeName: string | null = req.proposed_name ?? null;
      if (req.commune_id) {
        const { data: c } = await service
          .from("communes")
          .select("name, code_postal, contact_email, website_url, phone")
          .eq("id", req.commune_id)
          .maybeSingle();
        if (c) {
          communeName = c.name;
          commune = {
            name: c.name,
            code_postal: c.code_postal,
            contact_email: c.contact_email,
            website_url: c.website_url,
            phone: (c as { phone?: string | null }).phone ?? null,
          };
        }
      }
      const { subject, html } = buildRejectionEmail({
        siteUrl: getSiteUrl(),
        userName: fullName,
        reason,
        communeName,
        commune,
      });
      await sendEmail({ to: email, subject, html });
    }

    return NextResponse.json({ success: true });
  }

  // ─── Approbation ───
  let communeId = req.commune_id as string | null;
  // Un utilisateur rattaché est admin ou editor. On refuse tout autre
  // rôle (viewer/legacy) : un « viewer rattaché » n'est géré nulle part.
  const candidateRole = role || req.requested_role || "editor";
  const finalRole = candidateRole === "admin" ? "admin" : "editor";

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
        phone: req.proposed_phone || null,
        website_url: req.proposed_website || null,
        primary_color: "#1a2744",
        accent_color: "#c9a84c",
      })
      .select("id")
      .single();

    if (cErr || !newCommune) {
      return NextResponse.json({ error: cErr?.message || "Création commune échouée" }, { status: 500 });
    }
    communeId = newCommune.id;
  }

  if (!communeId) {
    return NextResponse.json({ error: "commune_id manquant" }, { status: 400 });
  }

  // ─── Modules autorisés par le super-admin ───
  // Les modules sont partagés au niveau de la COMMUNE (commune_modules),
  // mais l'autorisation d'un utilisateur se règle par UTILISATEUR
  // (profile_module_overrides). Il faut donc :
  //   • create : activer les modules choisis sur la NOUVELLE commune ;
  //   • join   : ne PAS toucher aux modules de la commune (config
  //     partagée avec les autres membres) ;
  //   • dans les deux cas : restreindre l'utilisateur approuvé aux
  //     seuls modules choisis (sinon, en rejoignant une commune déjà
  //     dotée de plusieurs modules, il les hériterait tous).
  const selected = new Set(
    modules.length > 0
      ? (
          await service
            .from("modules")
            .select("id")
            .in("id", modules)
            .eq("is_available", true)
        ).data?.map((m) => m.id) ?? []
      : [],
  );

  // create : activer les modules choisis sur la commune vierge
  if (req.request_type === "create" && selected.size > 0) {
    const rows = Array.from(selected).map((module_id) => ({
      commune_id: communeId!,
      module_id,
      activated_by: ctx!.userId,
    }));
    const { error: mErr } = await service
      .from("commune_modules")
      .upsert(rows, { onConflict: "commune_id,module_id" });
    if (mErr) console.error("[commune-requests] activation modules commune:", mErr.message);
  }

  // Restriction par utilisateur : l'utilisateur ne voit QUE les modules
  // choisis parmi ceux actifs sur la commune.
  const { data: communeMods } = await service
    .from("commune_modules")
    .select("module_id")
    .eq("commune_id", communeId);
  const communeModIds = (communeMods ?? []).map((m) => m.module_id as string);
  const toDisable = communeModIds.filter((id) => !selected.has(id));
  const toEnable = communeModIds.filter((id) => selected.has(id));

  if (toDisable.length > 0) {
    const now = new Date().toISOString();
    const { error: oErr } = await service
      .from("profile_module_overrides")
      .upsert(
        toDisable.map((module_id) => ({
          profile_id: req.user_id,
          module_id,
          enabled: false,
          updated_by: ctx!.userId,
          updated_at: now,
        })),
        { onConflict: "profile_id,module_id" },
      );
    if (oErr) console.error("[commune-requests] overrides disable:", oErr.message);
  }
  if (toEnable.length > 0) {
    // Retour au défaut (actif) pour les modules choisis : on retire
    // tout override désactivant hérité d'une décision précédente.
    await service
      .from("profile_module_overrides")
      .delete()
      .eq("profile_id", req.user_id)
      .in("module_id", toEnable);
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

  // Email d'approbation avec les coordonnées de la mairie (best-effort)
  const { email, fullName } = await getRecipient(service, req.user_id);
  if (email) {
    const { data: c } = await service
      .from("communes")
      .select("name, code_postal, contact_email, website_url, phone")
      .eq("id", communeId)
      .maybeSingle();
    const commune: CommuneContact | null = c
      ? {
          name: c.name,
          code_postal: c.code_postal,
          contact_email: c.contact_email,
          website_url: c.website_url,
          phone: (c as { phone?: string | null }).phone ?? null,
        }
      : null;
    const { subject, html } = buildApprovalEmail({
      siteUrl: getSiteUrl(),
      userName: fullName,
      role: finalRole,
      commune,
    });
    await sendEmail({ to: email, subject, html });
  }

  return NextResponse.json({ success: true, commune_id: communeId, role: finalRole });
}

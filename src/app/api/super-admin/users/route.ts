import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

const VALID_ROLES = ["super_admin", "admin", "editor", "viewer"];
const VALID_JOB_TITLES = ["maire", "adjoint", "conseiller", "dgs", "secretaire", "agent", "citoyen", "autre"];

// GET /api/super-admin/users — tous les utilisateurs avec leur commune
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const service = await createServiceClient();

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, job_title, commune_id, created_at, communes(name, slug)")
    .order("created_at", { ascending: false });

  const { data: { users: authUsers } } = await service.auth.admin.listUsers();

  const merged = (profiles ?? []).map((p) => {
    const u = authUsers?.find((au) => au.id === p.id);
    return {
      ...p,
      email: u?.email ?? null,
      last_sign_in_at: u?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json(merged);
}

// POST /api/super-admin/users — créer manuellement un utilisateur
//   body : { email, full_name?, role?, job_title?, commune_id?, send_invite? }
//   Si send_invite=true → magic link envoyé par email (par défaut)
//   Sinon : compte créé avec mot de passe temporaire renvoyé dans la réponse
export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const body = await request.json();
  const {
    email,
    full_name = null,
    role = "editor",
    job_title = null,
    commune_id = null,
    send_invite = true,
  } = body || {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }
  if (job_title && !VALID_JOB_TITLES.includes(job_title)) {
    return NextResponse.json({ error: "Fonction invalide" }, { status: 400 });
  }
  if ((role === "admin" || role === "editor") && !commune_id) {
    return NextResponse.json({ error: "Une commune est requise pour ce rôle" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Empêche les doublons : un email = un compte
  const { data: { users: existing } } = await service.auth.admin.listUsers();
  if (existing?.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
  }

  let userId: string | null = null;
  let tempPassword: string | null = null;

  if (send_invite) {
    // URL absolue de retour : on prend NEXT_PUBLIC_SITE_URL en prod ;
    // sinon Vercel injecte VERCEL_URL ; en dernier recours localhost.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    // Magic link / invitation par email — pas de mot de passe à transmettre
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${siteUrl}/auth/callback`,
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "Échec invitation" }, { status: 500 });
    }
    userId = data.user.id;
  } else {
    // Création directe avec mot de passe temporaire
    tempPassword = generateTempPassword();
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "Échec création" }, { status: 500 });
    }
    userId = data.user.id;
  }

  // Met à jour le profil (le trigger SQL le crée vide)
  const { error: profileErr } = await service
    .from("profiles")
    .upsert({ id: userId, full_name, role, job_title, commune_id });

  if (profileErr) {
    // Rollback : on supprime le compte auth pour pouvoir recommencer
    await service.auth.admin.deleteUser(userId!);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user_id: userId,
    invited: send_invite,
    temp_password: tempPassword,
  });
}

function generateTempPassword(): string {
  // 16 chars, alphanum + symboles raisonnables
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%";
  let p = "";
  for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

// PATCH /api/super-admin/users — modifier un user (rôle, nom, fonction, commune)
export async function PATCH(request: Request) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, role, full_name, job_title, commune_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }
    updates.role = role;
  }
  if (full_name !== undefined) updates.full_name = full_name || null;
  if (job_title !== undefined) {
    if (job_title !== null && !VALID_JOB_TITLES.includes(job_title)) {
      return NextResponse.json({ error: "Fonction invalide" }, { status: 400 });
    }
    updates.job_title = job_title || null;
  }
  if (commune_id !== undefined) updates.commune_id = commune_id || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  // Garde-fou : ne pas laisser la plateforme sans super-admin
  if (updates.role && updates.role !== "super_admin") {
    const service = await createServiceClient();
    const { data: current } = await service
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .single();
    if (current?.role === "super_admin") {
      const { count } = await service
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Impossible de retirer le dernier super-administrateur de la plateforme" },
          { status: 400 }
        );
      }
    }
  }

  const service = await createServiceClient();
  const { error } = await service.from("profiles").update(updates).eq("id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/super-admin/users?user_id=xxx — supprime un utilisateur
// (compte auth.users + profil, cascade sur ses surveys créées reste à la commune)
export async function DELETE(request: Request) {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  }
  if (userId === ctx?.userId) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte ici" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Protection : ne pas supprimer le dernier super-admin
  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (target?.role === "super_admin") {
    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Impossible de supprimer le dernier super-administrateur" },
        { status: 400 }
      );
    }
  }

  // Supprimer le compte auth (cascade via FK sur profiles)
  const { error: authErr } = await service.auth.admin.deleteUser(userId);
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  // Belt-and-suspenders : on s'assure que le profil est supprimé
  await service.from("profiles").delete().eq("id", userId);

  return NextResponse.json({ success: true });
}

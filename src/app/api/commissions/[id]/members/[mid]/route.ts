import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { FK_VIOLATION, softDeleteFields } from "@/lib/projects/soft-delete";

interface RouteParams { params: Promise<{ id: string; mid: string }>; }

const ROLES = ["president", "vice_president", "membre"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// PATCH — rôle, statut titulaire / suppléant et, pour un membre sans
// compte GoCiviq, nom, email et téléphone (oubli à la création).
// L'email d'un membre avec compte est celui de son compte : non modifiable ici.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const body = (await req.json().catch(() => ({}))) as {
    role?: unknown; statut_membre?: unknown;
    external_name?: unknown; external_email?: unknown; external_phone?: unknown;
  };
  const updates: Record<string, unknown> = {};
  if (body.statut_membre === "titulaire" || body.statut_membre === "suppleant") updates.statut_membre = body.statut_membre;
  if (typeof body.role === "string" && ROLES.includes(body.role)) updates.role = body.role;

  const service = await createServiceClient();
  const { data: actuel } = await service
    .from("commission_members")
    .select("id, user_id, contact_id")
    .eq("id", mid)
    .eq("commission_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!actuel) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  const coordonnees = "external_name" in body || "external_email" in body || "external_phone" in body;
  if (coordonnees) {
    if (actuel.user_id) {
      return NextResponse.json(
        { error: "Ce membre a un compte GoCiviq : son email est celui de son compte." },
        { status: 400 },
      );
    }
    if ("external_name" in body) {
      const nom = typeof body.external_name === "string" ? body.external_name.trim() : "";
      if (!nom) return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
      updates.external_name = nom.slice(0, 200);
    }
    if ("external_email" in body) {
      const email = typeof body.external_email === "string" ? body.external_email.trim() : "";
      if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
      updates.external_email = email || null;
    }
    if ("external_phone" in body) {
      const tel = typeof body.external_phone === "string" ? body.external_phone.trim() : "";
      updates.external_phone = tel.slice(0, 40) || null;
    }
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const { data, error } = await service
    .from("commission_members")
    .update(updates)
    .eq("id", mid)
    .eq("commission_id", id)
    .is("deleted_at", null)
    .select("id, role, statut_membre, external_name, external_email, external_phone")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  // La fiche de l'annuaire suit (même personne).
  if (coordonnees && actuel.contact_id) {
    const c: Record<string, unknown> = {};
    if ("external_name" in updates) c.nom = updates.external_name;
    if ("external_email" in updates) c.email = updates.external_email;
    if ("external_phone" in updates) c.telephone = updates.external_phone;
    const { error: cErr } = await service.from("contacts").update(c).eq("id", actuel.contact_id).eq("commune_id", access.communeId);
    if (cErr) console.error("[membre] mise à jour du contact:", cErr.message);
  }
  return NextResponse.json({ member: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  // Édition membres : ouverte aux éditeurs (élus/agents) de la commune
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  await retirerLignesVides(service, id, mid);
  // Un membre qui a déjà émargé ou été convoqué garde son historique :
  // suppression logique. Sinon (ajout par erreur), suppression réelle.
  const { error } = await service.from("commission_members").delete().eq("id", mid).eq("commission_id", id);
  if (error?.code === FK_VIOLATION) {
    const { error: softErr } = await service
      .from("commission_members")
      .update(softDeleteFields(access.userId))
      .eq("id", mid)
      .eq("commission_id", id);
    if (softErr) return NextResponse.json({ error: softErr.message }, { status: 500 });
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Retire le membre de l'émargement des séances encore ouvertes (compte
 * rendu non validé) tant que rien n'y est renseigné : sans cela, un
 * membre supprimé puis recréé apparaissait deux fois. Une présence
 * pointée ou une signature est conservée.
 */
async function retirerLignesVides(service: Awaited<ReturnType<typeof createServiceClient>>, commissionId: string, memberId: string) {
  const { data: membre } = await service
    .from("commission_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("commission_id", commissionId)
    .maybeSingle();
  if (!membre) return;
  if (membre.user_id) {
    // Le même élu peut figurer sur une autre fiche active de la commission.
    const { count } = await service
      .from("commission_members")
      .select("id", { count: "exact", head: true })
      .eq("commission_id", commissionId)
      .eq("user_id", membre.user_id)
      .is("deleted_at", null)
      .neq("id", memberId);
    if (count) return;
  }
  const { data: seances } = await service
    .from("commission_sessions")
    .select("id")
    .eq("commission_id", commissionId)
    .eq("compte_rendu_valide", false);
  const ids = (seances ?? []).map((x) => x.id);
  if (ids.length === 0) return;
  let q = service
    .from("session_attendance")
    .delete()
    .in("session_id", ids)
    .is("statut", null)
    .is("present", null)
    .is("signature_data", null);
  q = membre.user_id ? q.eq("conseiller_user_id", membre.user_id) : q.eq("commission_member_id", memberId);
  const { error } = await q;
  if (error) console.error("[membre] nettoyage de l'émargement:", error.message);
}

import { NextRequest, NextResponse } from "next/server";
import { requireCommissionEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import type { CommissionMemberRole } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

interface Body {
  /** Membre interne avec compte GoCiviq */
  user_id?: string;
  /** Membre externe — au moins external_name requis */
  external_name?: string;
  external_email?: string;
  external_phone?: string;
  role?: CommissionMemberRole;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  // Ouverture aux éditeurs : un élu/agent peut compléter la
  // composition d'une commission qu'il pilote.
  const access = await requireCommissionEdit(id);
  if (!access.ok) return access.response;
  const body = (await req.json()) as Body;

  const externalName = body.external_name?.trim();
  if (!body.user_id && !externalName) {
    return NextResponse.json(
      { error: "user_id (compte interne) ou external_name (membre externe) requis" },
      { status: 400 },
    );
  }

  const service = await createServiceClient();
  // Un membre interne doit être un compte de la même commune (il
  // recevra les convocations et comptes rendus par email).
  if (body.user_id) {
    const { data: member } = await service
      .from("profiles")
      .select("id")
      .eq("id", body.user_id)
      .eq("commune_id", access.communeId)
      .maybeSingle();
    if (!member) return NextResponse.json({ error: "Utilisateur introuvable dans cette commune" }, { status: 404 });
  }
  const { data, error } = await service
    .from("commission_members")
    .insert({
      commission_id: id,
      user_id: body.user_id || null,
      external_name: externalName || null,
      external_email: body.external_email?.trim() || null,
      external_phone: body.external_phone?.trim() || null,
      role: body.role ?? "membre",
    })
    .select("*, profile:profiles ( id, full_name, job_title )")
    .maybeSingle();
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

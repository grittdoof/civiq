import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { CommissionMemberRole } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

async function checkEditAccess(commissionId: string, role: string, communeId: string) {
  // Ouverture aux éditeurs : un élu/agent peut compléter la
  // composition d'une commission qu'il pilote.
  if (!["admin", "editor", "super_admin"].includes(role)) return false;
  const service = await createServiceClient();
  const { data } = await service.from("commissions").select("commune_id").eq("id", commissionId).maybeSingle();
  return data?.commune_id === communeId;
}

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
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const { id } = await params;
  if (!(await checkEditAccess(id, guard.role, guard.communeId))) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const body = (await req.json()) as Body;

  const externalName = body.external_name?.trim();
  if (!body.user_id && !externalName) {
    return NextResponse.json(
      { error: "user_id (compte interne) ou external_name (membre externe) requis" },
      { status: 400 },
    );
  }

  const service = await createServiceClient();
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

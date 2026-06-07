import { NextRequest, NextResponse } from "next/server";
import { requireModule } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import type { CommissionMemberRole } from "@/lib/projects/types";

interface RouteParams { params: Promise<{ id: string }>; }

async function checkAdminAccess(commissionId: string, role: string, communeId: string) {
  if (!["admin", "super_admin"].includes(role)) return false;
  const service = await createServiceClient();
  const { data } = await service.from("commissions").select("commune_id").eq("id", commissionId).maybeSingle();
  return data?.commune_id === communeId;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await requireModule("projects");
  if (!guard.ok) return guard.response;
  if (!guard.communeId) return NextResponse.json({ error: "Aucune commune" }, { status: 403 });
  const { id } = await params;
  if (!(await checkAdminAccess(id, guard.role, guard.communeId))) {
    return NextResponse.json({ error: "Permissions insuffisantes" }, { status: 403 });
  }
  const body = (await req.json()) as { user_id?: string; role?: CommissionMemberRole };
  if (!body.user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from("commission_members")
    .insert({ commission_id: id, user_id: body.user_id, role: body.role ?? "membre" })
    .select("*, profile:profiles ( id, full_name, job_title )")
    .maybeSingle();
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

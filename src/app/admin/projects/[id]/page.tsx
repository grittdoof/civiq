import { notFound, redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id] — alias vers la phase courante du projet.
//
// Le nouveau flow place la phase comme point d'entrée unique. Cette
// route reste pour préserver les liens existants (menu, sidebar,
// notifications) et redirige vers /phase/[currentPhase].
//
// Pour la vue synthèse, voir /admin/projects/[id]/fiche.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectAliasPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const service = await createServiceClient();
  const { data: row } = await service
    .from("projects")
    .select("id, phase")
    .eq("id", id)
    .eq("commune_id", ctx.communeId)
    .maybeSingle();

  if (!row) notFound();

  redirect(`/admin/projects/${id}/phase/${row.phase}`);
}

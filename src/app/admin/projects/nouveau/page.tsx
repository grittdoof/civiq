import { redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/nouveau — création silencieuse
//
// Plus de formulaire à remplir avant que le projet existe. La page
// crée un projet vide (titre = « Sans titre ») et redirige
// instantanément vers le 1er livrable de la phase Émergence,
// où l'utilisateur saisira l'identité du projet (titre, description,
// objectifs, photo).
//
// Si on vient d'un ticket : on prend le titre + description du
// ticket comme amorce et on lie source_ticket_id.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from_ticket?: string }>;
}

export default async function NewProjectPage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (!["admin", "editor", "super_admin"].includes(ctx.role ?? "")) {
    redirect("/admin/projects");
  }

  const { from_ticket } = await searchParams;

  const service = await createServiceClient();

  // Amorce depuis un ticket si fourni
  let titre = "Sans titre";
  let description: string | null = null;
  let sourceTicketId: string | null = null;
  if (from_ticket) {
    const { data: ticket } = await service
      .from("tickets")
      .select("id, titre, description")
      .eq("id", from_ticket)
      .eq("commune_id", ctx.communeId)
      .maybeSingle();
    if (ticket) {
      titre = ticket.titre;
      description = ticket.description;
      sourceTicketId = ticket.id;
    }
  }

  // Création silencieuse
  const { data, error } = await service
    .from("projects")
    .insert({
      commune_id: ctx.communeId,
      titre,
      description,
      source_ticket_id: sourceTicketId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // En cas d'échec on retombe sur la liste avec un état d'erreur
    redirect("/admin/projects?error=create_failed");
  }

  // Redirige sur le 1er livrable de la phase Émergence
  redirect(`/admin/projects/${data.id}/phase/emergence/0`);
}

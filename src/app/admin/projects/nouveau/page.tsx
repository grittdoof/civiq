import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import ProjectForm from "@/components/projects/ProjectForm";

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
  const { data: profilesDir } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("commune_id", ctx.communeId);

  // Si on vient d'un ticket : préremplir titre + description + source_ticket_id
  let initial = {};
  if (from_ticket) {
    const { data: ticket } = await service
      .from("tickets")
      .select("id, titre, description")
      .eq("id", from_ticket)
      .eq("commune_id", ctx.communeId)
      .maybeSingle();
    if (ticket) {
      initial = {
        titre: ticket.titre,
        description: ticket.description,
        source_ticket_id: ticket.id,
      };
    }
  }

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Tous les projets
        </Link>
      </div>
      <h1 className="civiq-page-title">Nouveau projet</h1>
      <p className="pj-page-subtitle">
        Démarre en étape « Émergence ». Vous pourrez compléter les autres
        sections après création.
      </p>

      <ProjectForm
        mode="create"
        initial={initial}
        profilesDirectory={(profilesDir ?? []) as { id: string; full_name: string | null; job_title: string | null }[]}
      />
    </main>
  );
}

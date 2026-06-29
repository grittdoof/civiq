import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { getProject } from "@/lib/projects/queries";
import ProjectForm from "@/components/projects/ProjectForm";
import ProjectTypeChanger from "@/components/projects/ProjectTypeChanger";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }>; }

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (!["admin", "editor", "super_admin"].includes(ctx.role ?? "")) {
    redirect(`/admin/projects/${id}`);
  }

  const detail = await getProject(ctx.communeId, id);
  if (!detail.project) notFound();
  const p = detail.project;

  const service = await createServiceClient();
  const { data: profilesDir } = await service
    .from("profiles")
    .select("id, full_name, job_title")
    .eq("commune_id", ctx.communeId);

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href={`/admin/projects/${id}`} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Retour à la fiche
        </Link>
      </div>
      <div className="pj-edit-head">
        <h1 className="civiq-page-title">Modifier le projet</h1>
        <ProjectTypeChanger
          projectId={id}
          currentType={p.type}
          canEdit={["admin", "editor", "super_admin"].includes(ctx.role ?? "")}
        />
      </div>

      <ProjectForm
        mode="edit"
        projectId={id}
        initial={{
          titre: p.titre,
          description: p.description,
          objectifs: p.objectifs,
          competence: p.competence,
          budget_estime: p.budget_estime,
          sans_subvention: p.sans_subvention,
          pilote_elu: p.pilote_elu,
          pilote_agent: p.pilote_agent,
          taux_inflation: p.taux_inflation,
          taux_actualisation: p.taux_actualisation,
        }}
        profilesDirectory={(profilesDir ?? []) as { id: string; full_name: string | null; job_title: string | null }[]}
      />
    </main>
  );
}

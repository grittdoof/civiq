import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import "../../projects.css";
import "../../flow.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id]/fiche — synthèse en lecture seule (stub
// pour Phase A — sera enrichie en Phase E avec ProjectSummaryView).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectFichePage({ params }: Props) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const service = await createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("id, titre, phase")
    .eq("id", id)
    .eq("commune_id", ctx.communeId)
    .maybeSingle();

  if (!project) notFound();

  return (
    <main className="civiq-main pj-flow-page">
      <div className="pj-flow-topbar">
        <div className="pj-flow-topbar-title">
          <Link
            href={`/admin/projects/${id}/phase/${project.phase}`}
            className="pj-flow-back-pill"
            title="Retour aux phases"
          >
            <ArrowLeft size={14} />
          </Link>
          <h1 className="pj-flow-project-title">{project.titre}</h1>
        </div>
      </div>

      <div className="civiq-card" style={{ padding: 28, textAlign: "center", maxWidth: 560, margin: "32px auto" }}>
        <Info size={24} style={{ opacity: 0.5, marginBottom: 12 }} />
        <h2 style={{ marginBottom: 8 }}>Synthèse en construction</h2>
        <p style={{ color: "var(--civiq-text-light, #888)", lineHeight: 1.55, marginBottom: 18 }}>
          La fiche projet en lecture seule sera disponible dans la
          prochaine livraison. Elle agrégera automatiquement tout ce
          que vous saisirez au fil des phases.
        </p>
        <Link
          href={`/admin/projects/${id}/phase/${project.phase}`}
          className="civiq-btn civiq-btn-default"
        >
          Continuer la configuration par phases
        </Link>
      </div>
    </main>
  );
}

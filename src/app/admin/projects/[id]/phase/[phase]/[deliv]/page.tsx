import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  PROJECT_PHASE_GUIDE,
  type ProjectPhase,
} from "@/lib/projects/types";
import "../../../../projects.css";
import "../../../../flow.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/[id]/phase/[phase]/[deliv]
// Page dédiée à un livrable (stub Phase A, sera remplie Phase B+).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; phase: string; deliv: string }>;
}

export default async function DeliverableStub({ params }: Props) {
  const { id, phase: phaseParam, deliv } = await params;
  const phase = phaseParam as ProjectPhase;
  if (!PROJECT_PHASES.includes(phase)) notFound();
  const idx = Number.parseInt(deliv, 10);
  if (Number.isNaN(idx)) notFound();

  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const service = await createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("id, titre")
    .eq("id", id)
    .eq("commune_id", ctx.communeId)
    .maybeSingle();
  if (!project) notFound();

  const guide = PROJECT_PHASE_GUIDE[phase];
  const spec = guide.deliverables[idx];
  if (!spec) notFound();

  return (
    <main className="civiq-main pj-flow-page">
      <div className="pj-flow-topbar">
        <div className="pj-flow-topbar-title">
          <Link
            href={`/admin/projects/${id}/phase/${phase}`}
            className="pj-flow-back-pill"
          >
            <ArrowLeft size={14} />
          </Link>
          <h1 className="pj-flow-project-title">
            {PROJECT_PHASE_LABELS[phase]} · Livrable {idx + 1}/{guide.deliverables.length}
          </h1>
        </div>
      </div>

      <div className="civiq-card" style={{ padding: 28, maxWidth: 720, margin: "24px auto" }}>
        <Info size={20} style={{ opacity: 0.5 }} />
        <h2 style={{ margin: "10px 0 8px", fontSize: 22 }}>{spec.label}</h2>
        <p style={{ color: "var(--civiq-text-light, #888)", marginBottom: 16 }}>
          Type : {spec.kind}
        </p>
        <p style={{ color: "var(--civiq-text, #1a2744)", lineHeight: 1.6, marginBottom: 18 }}>
          Le formulaire focalisé pour ce type de livrable arrive dans
          la prochaine livraison. Vous pourrez ici renseigner les
          informations sans quitter la phase, et l&apos;avancement se
          mettra à jour automatiquement.
        </p>
        <Link
          href={`/admin/projects/${id}/phase/${phase}`}
          className="civiq-btn civiq-btn-default"
        >
          Retour à la phase
        </Link>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getCommuneSettings } from "@/lib/projects/queries";
import CommuneParametresForm from "@/components/projects/CommuneParametresForm";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/parametres — paramètres « projets » de la commune
// (délégation au maire, guide interne des achats, FCTVA, INSEE).
// Modifiables sans redéploiement ; lecture seule pour les éditeurs.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function ProjectsParametresPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const settings = await getCommuneSettings(ctx.communeId);
  const canEdit = ctx.role === "admin" || ctx.role === "super_admin";

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
      </div>
      <h1 className="civiq-page-title">Paramètres des projets</h1>
      <p className="pj-page-subtitle">
        Quelques informations propres à votre commune. Elles servent à vous prévenir au bon moment ; tout est
        facultatif.
      </p>
      <CommuneParametresForm initial={settings} canEdit={canEdit} />
    </main>
  );
}

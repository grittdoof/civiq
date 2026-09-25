import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { STAKEHOLDER_COLUMNS } from "@/lib/projects/queries";
import type { Stakeholder } from "@/lib/projects/types";
import ProjectWizard, { type WizardTypeRow } from "@/components/projects/ProjectWizard";
import "../projects.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/nouveau — assistant de création (lot B).
//
// Plus aucune création silencieuse : le projet n'existe qu'une fois le
// parcours validé (POST /api/projects). Paramètres :
//   ?from_ticket=ID      → titre et description repris du ticket, lien conservé
//   ?from_commission=ID  → commission pilote présélectionnée
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from_ticket?: string; from_commission?: string }>;
}

export default async function NewProjectPage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (!["admin", "editor", "super_admin"].includes(ctx.role ?? "")) redirect("/admin/projects");

  const { from_ticket, from_commission } = await searchParams;
  const service = await createServiceClient();

  const [{ data: types }, { data: commissions }, { data: people }, { data: associations }, ticketRes] = await Promise.all([
    service.from("types_projet").select("code, libelle, accroche, exemples, jalons_modele").eq("actif", true).order("ordre"),
    service.from("commissions").select("id, nom, color").eq("commune_id", ctx.communeId).eq("active", true)
      .is("deleted_at", null).order("nom"),
    service.from("profiles").select("id, full_name, job_title").eq("commune_id", ctx.communeId).order("full_name"),
    service.from("contacts").select(STAKEHOLDER_COLUMNS).eq("commune_id", ctx.communeId).eq("type", "association")
      .is("deleted_at", null).order("nom"),
    from_ticket
      ? service.from("tickets").select("id, titre, description").eq("id", from_ticket).eq("commune_id", ctx.communeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ticket = ticketRes.data as { id: string; titre: string; description: string | null } | null;
  const commissionOk = from_commission && (commissions ?? []).some((c) => c.id === from_commission);

  return (
    <main className="civiq-main pj-wiz-page">
      <div className="pj-detail-back">
        <Link href="/admin/projects" className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} aria-hidden="true" /> Tous les projets
        </Link>
      </div>
      <h1 className="civiq-page-title">Nouveau projet</h1>
      {ticket && (
        <p className="pj-page-subtitle">À partir du signalement « {ticket.titre} ».</p>
      )}
      <ProjectWizard
        types={(types ?? []) as WizardTypeRow[]}
        commissions={commissions ?? []}
        people={people ?? []}
        associations={(associations ?? []) as unknown as Stakeholder[]}
        currentUserId={ctx.userId}
        prefill={{
          titre: ticket?.titre,
          description: ticket?.description ?? undefined,
          source_ticket_id: ticket?.id,
          commission_pilote_id: commissionOk ? from_commission : undefined,
        }}
      />
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../../../../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import NewSessionForm from "@/components/projects/NewSessionForm";
import { listConvocationRecipients } from "@/lib/projects/convocation-send";

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string }>; }

export default async function NewSessionPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (!["admin", "editor", "super_admin"].includes(ctx.role ?? "")) {
    redirect(`/admin/commissions/${id}`);
  }

  const service = await createServiceClient();
  const { data: commission } = await service
    .from("commissions")
    .select("nom, commune_id")
    .is("deleted_at", null)
    .eq("id", id)
    .maybeSingle();
  if (!commission || commission.commune_id !== ctx.communeId) notFound();

  const [{ data: profiles }, recipients] = await Promise.all([
    service.from("profiles").select("id, full_name").eq("commune_id", ctx.communeId),
    listConvocationRecipients(service, id),
  ]);

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href={`/admin/commissions/${id}`} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Commission
        </Link>
      </div>
      <h1 className="civiq-page-title">Nouvelle séance — {commission.nom}</h1>
      <p className="pj-page-subtitle">
        Après validation, la convocation est envoyée par email à chaque membre
        (avec ou sans compte GoCiviq) : ordre du jour, ajout à l&apos;agenda et
        réponse de présence en un clic. Les membres avec compte reçoivent
        aussi une notification push.
      </p>
      <NewSessionForm
        commissionId={id}
        profiles={(profiles ?? []) as { id: string; full_name: string | null }[]}
        recipients={recipients.map((r) => ({
          member_id: r.member_id,
          name: r.name,
          email: r.email,
          isExternal: r.isExternal,
        }))}
      />
    </main>
  );
}

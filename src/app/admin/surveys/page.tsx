import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText, TrendingUp, Users, Target,
  Plus, Trash2, ArrowLeft,
} from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { isModuleActive } from "@/lib/module-guard";
import SurveysSection from "../dashboard/SurveysSection";

// ═══════════════════════════════════════════════════════════════
// /admin/surveys — Tableau de bord du module Sondages
//
// Page dédiée aux KPIs et à la gestion des sondages, distincte du
// /admin/dashboard cross-module. Affiche uniquement les indicateurs
// liés aux sondages (créés, actifs, réponses, taux d'engagement).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function SurveysDashboardPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");

  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("surveys");
    if (!active) redirect("/admin/dashboard?module=surveys&state=inactive");
  }

  // KPIs sondages
  const service = await createServiceClient();
  const { data: surveys } = await service
    .from("surveys")
    .select("id, status, created_at, ends_at, responses(count)")
    .eq("commune_id", ctx.communeId)
    .is("deleted_at", null);

  const total = surveys?.length ?? 0;
  const active = surveys?.filter((s) => s.status === "published").length ?? 0;
  const draft = surveys?.filter((s) => s.status === "draft").length ?? 0;
  const totalResponses = (surveys ?? []).reduce((sum, s) => {
    const arr = s.responses as unknown as { count: number }[] | undefined;
    return sum + (arr?.[0]?.count ?? 0);
  }, 0);

  // Réponses 30 derniers jours
  const sinceISO = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: recent } = await service
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("commune_id", ctx.communeId)
    .gte("submitted_at", sinceISO);
  const responses30d = (recent as unknown as { count?: number })?.count ?? 0;

  // Estimation taux d'engagement moyen (sur sondages publiés)
  const published = (surveys ?? []).filter((s) => s.status === "published");
  const avgResponses = published.length
    ? Math.round(
        published.reduce((sum, s) => {
          const arr = s.responses as unknown as { count: number }[] | undefined;
          return sum + (arr?.[0]?.count ?? 0);
        }, 0) / published.length
      )
    : 0;

  const canCreate = ctx.role === "admin" || ctx.role === "super_admin";
  const canDelete = ctx.role === "admin" || ctx.role === "super_admin";

  return (
    <main className="civiq-main">
      <Link
        href="/admin/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 14 }}
      >
        <ArrowLeft size={14} /> Tableau de bord général
      </Link>

      <div className="civiq-page-header">
        <div>
          <h1 className="civiq-page-title">Mes sondages</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
            Indicateurs et gestion du module Sondages.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canDelete && (
            <Link href="/admin/surveys/trash" className="civiq-btn civiq-btn-outline civiq-btn-sm">
              <Trash2 size={13} /> Corbeille
            </Link>
          )}
          {canCreate && (
            <Link href="/admin/surveys/new" className="civiq-btn civiq-btn-default civiq-btn-sm">
              <Plus size={13} /> Nouveau sondage
            </Link>
          )}
        </div>
      </div>

      {/* KPIs spécifiques sondages */}
      <div className="civiq-stats-grid" style={{ marginBottom: 26 }}>
        <Kpi icon={<FileText size={18} />} value={total} label="Sondages créés" sub={draft ? `${draft} en brouillon` : "tous publiés ou archivés"} />
        <Kpi icon={<TrendingUp size={18} />} value={active} label="Sondages actifs" sub="actuellement publiés" tone="success" />
        <Kpi icon={<Users size={18} />} value={totalResponses} label="Réponses cumulées" sub={`${responses30d} sur 30 j`} />
        <Kpi icon={<Target size={18} />} value={avgResponses} label="Réponses / sondage" sub="moyenne par sondage publié" tone="accent" />
      </div>

      {/* Liste détaillée — composant client existant */}
      <SurveysSection />
    </main>
  );
}

function Kpi({ icon, value, label, sub, tone }: {
  icon: React.ReactNode; value: number | string; label: string; sub?: string;
  tone?: "default" | "success" | "accent";
}) {
  const bg =
    tone === "success" ? "oklch(0.95 0.06 155)" :
    tone === "accent"  ? "oklch(0.95 0.05 30)"  :
    "oklch(0.95 0.04 258)";
  const fg =
    tone === "success" ? "var(--success)" : "var(--accent)";
  return (
    <div className="civiq-card civiq-stat-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: "var(--radius)", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--fg)", lineHeight: 1.05 }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "var(--fg-xmuted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

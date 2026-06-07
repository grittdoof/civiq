import { redirect } from "next/navigation";
import "../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { listCalendarEvents } from "@/lib/projects/calendar-queries";
import CalendarView from "@/components/projects/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendrierPage() {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const events = await listCalendarEvents(ctx.communeId);

  return (
    <main className="civiq-main pj-detail-page">
      <header className="pj-page-header">
        <div>
          <h1 className="civiq-page-title">Calendrier</h1>
          <p className="pj-page-subtitle">
            Vue chronologique des dates clés de vos projets et des
            séances de commission.
          </p>
        </div>
      </header>

      <CalendarView events={events} />
    </main>
  );
}

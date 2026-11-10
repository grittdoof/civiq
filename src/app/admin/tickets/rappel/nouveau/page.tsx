import { redirect } from "next/navigation";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { peutCreer } from "@/lib/tickets/droits";
import { listerPersonnesCommune } from "@/lib/tickets/mutations";
import { createServiceClient } from "@/lib/supabase-server";
import { reglagesParDefautRappel } from "@/lib/tickets/rappels-server";
import RappelForm from "./RappelForm";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/rappel/nouveau — Programmer un rappel
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function NouveauRappelPage() {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin" && !(await isModuleActive("tickets"))) redirect("/admin/dashboard?module=tickets&state=inactive");
  const spectateur = await chargerSpectateur();
  if (!spectateur || !peutCreer(spectateur)) redirect("/admin/tickets");

  const service = await createServiceClient();
  const [personnes, { serviceId }] = await Promise.all([
    listerPersonnesCommune(),
    reglagesParDefautRappel(service, ctx.communeId),
  ]);
  const { data: svc } = serviceId
    ? await service.from("services").select("nom").eq("id", serviceId).maybeSingle()
    : { data: null };
  return <RappelForm personnes={personnes} moi={ctx.userId} nomService={(svc?.nom as string | undefined) ?? null} />;
}

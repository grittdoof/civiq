import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { fonctionDe } from "@/lib/tickets/droits";
import { pageAccueil } from "@/lib/tickets/interventions";

// ═══════════════════════════════════════════════════════════════
// /admin/accueil — page d'arrivée selon le profil (lot 3).
// Utilisée au lancement de l'application installée (PWA), après la
// connexion et par /admin. Agent → ses interventions ; responsable →
// son service ; adjoint → sa délégation ; accueil → ses demandes ;
// maire et direction → tableau de bord.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function AccueilPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/auth/login?redirect=%2Fadmin%2Faccueil");
  const { source } = await searchParams;

  const service = await createServiceClient();
  const { data: profil } = await service.from("profiles").select("job_title").eq("id", ctx.userId).maybeSingle();
  const cible = pageAccueil({
    role: ctx.role,
    fonction: fonctionDe(profil?.job_title ?? null),
    ticketsActif: ctx.role !== "viewer" && (await isModuleActive("tickets")),
  });
  const suffixe = source ? `${cible.includes("?") ? "&" : "?"}source=${encodeURIComponent(source)}` : "";
  redirect(cible + suffixe);
}

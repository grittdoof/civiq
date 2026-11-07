import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase-server";
import { listerCategories } from "@/lib/tickets/categories-server";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getTicket } from "@/lib/tickets/queries";
import { chargerSpectateur } from "@/lib/tickets/droits-server";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import EditTicketForm from "./EditTicketForm";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/[id]/modifier — Édition d'un ticket existant.
// Server Component qui pré-charge le ticket + agents.
// Chaque modification est automatiquement journalisée.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTicketPage({ params }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const { id } = await params;
  const { ticket, assignees, droits } = await getTicket(ctx.communeId, id, await chargerSpectateur());
  if (!ticket || !droits) notFound();

  // Droit « modifier » de la matrice de la commune (lot 1)
  if (!droits.modifier) {
    redirect(`/admin/tickets/${id}?error=forbidden`);
  }

  const service = await createServiceClient();
  const [agents, toutes] = await Promise.all([listAssignableAgents(), listerCategories(service, ctx.communeId)]);
  // Actives + celle du ticket (même désactivée, pour ne pas la perdre)
  const categories = toutes.filter((c) => c.actif || c.id === ticket.categorie_id
    || toutes.some((e) => e.parent_id === c.id && e.id === ticket.categorie_id));

  return (
    <EditTicketForm
      communeId={ctx.communeId}
      agents={agents}
      ticket={{
        id: ticket.id,
        numero: ticket.numero,
        canal: ticket.canal,
        titre: ticket.titre,
        description: ticket.description,
        categorie_id: ticket.categorie_id ?? null,
        urgence: ticket.urgence ?? null,
        transmis_a: ticket.transmis_a ?? null,
        transmis_le: ticket.transmis_le ?? null,
        transmis_reference: ticket.transmis_reference ?? null,
        adresse: ticket.adresse,
        latitude: ticket.latitude,
        longitude: ticket.longitude,
        precision_geo: ticket.precision_geo,
        demandeur_nom: ticket.demandeur_nom,
        demandeur_telephone: ticket.demandeur_telephone,
        demandeur_email: ticket.demandeur_email,
        demandeur_adresse: ticket.demandeur_adresse,
        echeance: ticket.echeance,
      }}
      initialAssigneeIds={assignees.map((a) => a.id)}
      categories={categories}
      peutAssigner={droits.assigner}
    />
  );
}

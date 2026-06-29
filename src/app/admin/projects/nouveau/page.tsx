import { redirect } from "next/navigation";
import Link from "next/link";
import { Lightbulb, PartyPopper, ListChecks, ArrowRight } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import {
  PROJECT_TYPE_META,
  suggestProjectType,
  type ProjectType,
  type ProjectPhase,
} from "@/lib/projects/types";
import "../projects.css";

// ═══════════════════════════════════════════════════════════════
// /admin/projects/nouveau — sélection du gabarit puis création
//
// Migration 028 : 3 gabarits (investment / event / tracking). On
// présente d'abord les 3 cartes pour que l'utilisateur choisisse.
// La carte « pré-suggérée » est mise en avant si :
//   • ?from_commission=ID est fourni → la commission est interrogée
//     et son nom passé à suggestProjectType()
//   • ?from_ticket=ID est fourni → on amorce avec les infos du ticket
//
// Quand l'utilisateur clique une carte, on arrive ici avec ?type=...
// et on fait la création silencieuse comme avant.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    from_ticket?: string;
    from_commission?: string;
    type?: string;
  }>;
}

const VALID_TYPES: ProjectType[] = ["investment", "event", "tracking"];
const TYPE_ICONS: Record<ProjectType, typeof Lightbulb> = {
  investment: Lightbulb,
  event: PartyPopper,
  tracking: ListChecks,
};
const FIRST_PHASE_BY_TYPE: Record<ProjectType, ProjectPhase> = {
  investment: "emergence",
  event: "event_framing",
  tracking: "tracking_framing",
};

export default async function NewProjectPage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (!["admin", "editor", "super_admin"].includes(ctx.role ?? "")) {
    redirect("/admin/projects");
  }

  const { from_ticket, from_commission, type } = await searchParams;

  // Type choisi → création silencieuse comme avant + redirection
  if (type && VALID_TYPES.includes(type as ProjectType)) {
    return createSilently(
      ctx.communeId,
      ctx.userId,
      type as ProjectType,
      from_ticket ?? null,
    );
  }

  // Sinon : on affiche le sélecteur de gabarit
  const service = await createServiceClient();
  let suggested: ProjectType = "tracking";
  if (from_commission) {
    const { data: commission } = await service
      .from("commissions")
      .select("nom")
      .eq("id", from_commission)
      .eq("commune_id", ctx.communeId)
      .maybeSingle();
    if (commission?.nom) suggested = suggestProjectType(commission.nom);
  }

  const carryParams = new URLSearchParams();
  if (from_ticket) carryParams.set("from_ticket", from_ticket);
  if (from_commission) carryParams.set("from_commission", from_commission);
  const carry = carryParams.toString();

  return (
    <main className="civiq-main">
      <header className="pj-new-head">
        <Link href="/admin/projects" className="civiq-back-link">
          ← Retour aux projets
        </Link>
        <h1 className="pj-new-title">Quel type de projet ?</h1>
        <p className="pj-new-sub">
          Chaque gabarit propose ses phases et ses livrables.
          {from_commission && suggested && (
            <>
              {" "}Le gabarit{" "}
              <strong>{PROJECT_TYPE_META[suggested].label.toLowerCase()}</strong>{" "}
              est suggéré pour cette commission, mais vous pouvez choisir
              librement — le type reste modifiable ensuite.
            </>
          )}
        </p>
      </header>

      <ul className="pj-new-types">
        {VALID_TYPES.map((t) => {
          const meta = PROJECT_TYPE_META[t];
          const Icon = TYPE_ICONS[t];
          const isSuggested = t === suggested && Boolean(from_commission);
          const params = new URLSearchParams(carry);
          params.set("type", t);
          return (
            <li key={t} className="pj-new-type-item">
              <Link
                href={`/admin/projects/nouveau?${params.toString()}`}
                className={`pj-new-type-card${isSuggested ? " is-suggested" : ""}`}
              >
                {isSuggested && (
                  <span className="pj-new-type-badge">Suggéré</span>
                )}
                <span className="pj-new-type-icon" aria-hidden>
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <h2 className="pj-new-type-label">{meta.label}</h2>
                <p className="pj-new-type-tagline">{meta.tagline}</p>
                <p className="pj-new-type-example">
                  <em>Ex.</em> {meta.example}
                </p>
                <span className="pj-new-type-cta">
                  Choisir <ArrowRight size={14} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

// ─── Création silencieuse + redirection vers premier livrable ───
async function createSilently(
  communeId: string,
  userId: string | null,
  type: ProjectType,
  fromTicketId: string | null,
): Promise<never> {
  const service = await createServiceClient();
  let titre = "Sans titre";
  let description: string | null = null;
  let sourceTicketId: string | null = null;

  if (fromTicketId) {
    const { data: ticket } = await service
      .from("tickets")
      .select("id, titre, description")
      .eq("id", fromTicketId)
      .eq("commune_id", communeId)
      .maybeSingle();
    if (ticket) {
      titre = ticket.titre;
      description = ticket.description;
      sourceTicketId = ticket.id;
    }
  }

  const firstPhase = FIRST_PHASE_BY_TYPE[type];
  const { data, error } = await service
    .from("projects")
    .insert({
      commune_id: communeId,
      titre,
      description,
      type,
      phase: firstPhase,
      source_ticket_id: sourceTicketId,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/admin/projects?error=create_failed");
  }
  redirect(`/admin/projects/${data.id}/phase/${firstPhase}/0`);
}

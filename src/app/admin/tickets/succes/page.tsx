import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCommune } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import {
  TKButton,
  TKHeader,
  TKCtaBar,
} from "@/components/tickets/ui/tk-primitives";
import { TK } from "@/lib/tickets/design-tokens";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/succes?id=<uuid>&kind=created|closed
// Écran de célébration sobre (Airbnb-style) après création ou clôture.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ id?: string; kind?: string }>;
}

export default async function TicketSuccessPage({ searchParams }: Props) {
  const { id, kind = "created" } = await searchParams;
  if (!id) redirect("/admin/tickets");

  const ctx = await requireCommune();
  const service = await createServiceClient();
  const { data: ticket } = await service
    .from("tickets")
    .select("id, numero, commune_id, assigne_a")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) redirect("/admin/tickets");
  if (ctx.role !== "super_admin" && ticket.commune_id !== ctx.communeId) {
    redirect("/admin/tickets");
  }

  // Compte des assignés (multi)
  const { count: assigneeCount } = await service
    .from("ticket_assignees")
    .select("ticket_id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id);

  const notifiedCount =
    (assigneeCount ?? 0) || (ticket.assigne_a ? 1 : 0);

  const cfg =
    kind === "closed"
      ? {
          eyebrow: "Ticket clôturé",
          emoji: "✅",
          title: "Bravo, le ticket est clôturé.",
          sub: `Ticket #${ticket.numero} archivé avec son rapport.`,
          primary: { href: `/admin/tickets/${ticket.id}`, label: "Voir le ticket" },
          secondary: { href: "/admin/tickets", label: "Retour à la liste" },
          showNotif: false,
        }
      : {
          eyebrow: "Ticket créé",
          emoji: "🎉",
          title: "C'est fait, ton ticket est en ligne.",
          sub: `Ticket #${ticket.numero} ouvert. ${
            notifiedCount > 0 ? "L'équipe est notifiée." : "Aucun assigné pour l'instant."
          }`,
          primary: { href: `/admin/tickets/${ticket.id}`, label: "Voir le ticket" },
          secondary: { href: "/admin/tickets/nouveau", label: "Créer un autre ticket" },
          showNotif: notifiedCount > 0,
        };

  return (
    <main
      className="relative flex min-h-[100dvh] flex-col bg-white"
      style={{ paddingTop: 8 }}
    >
      <TKHeader />

      <div className="flex flex-1 flex-col justify-center px-[26px]">
        <div
          className="text-[11px] font-bold uppercase"
          style={{ color: TK.muted, letterSpacing: "0.14em" }}
        >
          {cfg.eyebrow}
        </div>

        <div className="mt-3 leading-none" style={{ fontSize: 72 }}>
          {cfg.emoji}
        </div>

        <h1
          className="mb-2 mt-5 font-bold"
          style={{
            color: TK.ink,
            fontSize: 30,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
          }}
        >
          {cfg.title}
        </h1>

        <p
          className="m-0 text-[15px]"
          style={{ color: TK.muted, lineHeight: 1.5 }}
        >
          {cfg.sub}
        </p>

        {cfg.showNotif && (
          <div
            className="mt-6 flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ border: `1.5px solid ${TK.line}` }}
          >
            <div
              className="inline-flex items-center justify-center rounded-[10px] text-lg"
              style={{
                width: 42,
                height: 42,
                background: TK.marine + "14",
                color: TK.marine,
              }}
            >
              📩
            </div>
            <div className="flex-1">
              <div
                className="text-[13px] font-bold"
                style={{ color: TK.ink }}
              >
                Notifications envoyées
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: TK.muted }}>
                {notifiedCount} agent{notifiedCount > 1 ? "s" : ""} notifié
                {notifiedCount > 1 ? "s" : ""} par push
              </div>
            </div>
          </div>
        )}
      </div>

      <TKCtaBar mode="fixed">
        <div className="flex flex-col gap-2.5">
          <Link href={cfg.primary.href}>
            <TKButton variant="primary">{cfg.primary.label}</TKButton>
          </Link>
          <Link href={cfg.secondary.href}>
            <TKButton variant="ghost">{cfg.secondary.label}</TKButton>
          </Link>
        </div>
      </TKCtaBar>
    </main>
  );
}

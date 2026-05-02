"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════
// Hook : abonne le client à toute modification des tickets de la
// commune et déclenche un router.refresh() pour re-fetcher la
// page Server Component.
//
// À utiliser dans un Client Component placé dans la liste et le
// détail du ticket (TicketsRealtime.tsx, monté en bas de page).
// ═══════════════════════════════════════════════════════════════

export function useTicketsRealtime(communeId: string | null, ticketId?: string) {
  const router = useRouter();

  useEffect(() => {
    if (!communeId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`tickets-${communeId}${ticketId ? "-" + ticketId : ""}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: ticketId ? `id=eq.${ticketId}` : `commune_id=eq.${communeId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_commentaires", filter: ticketId ? `ticket_id=eq.${ticketId}` : undefined },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_photos", filter: ticketId ? `ticket_id=eq.${ticketId}` : undefined },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communeId, ticketId, router]);
}

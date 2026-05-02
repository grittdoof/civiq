"use client";

import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";

// Wrapper Client à monter en bas d'une page Server Component pour
// activer la mise à jour temps réel des tickets.
export default function TicketsRealtime({ communeId, ticketId }: { communeId: string; ticketId?: string }) {
  useTicketsRealtime(communeId, ticketId);
  return null;
}

// Après une modification du calendrier (étape, séance, dates d'un
// projet…) : pousse les changements vers les Google Agenda connectés de
// la commune, après l'envoi de la réponse (next/server `after`, qui
// prolonge la fonction sur Vercel au lieu de la geler).
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { googleConfigure, synchroniserCommuneGoogle } from "./google";

export function synchroniserAgendasApres(communeId: string | null | undefined): void {
  if (!communeId || !googleConfigure()) return;
  after(async () => {
    try {
      const service = await createServiceClient();
      await synchroniserCommuneGoogle(service, communeId);
    } catch (e) {
      console.error("[google-agenda] synchronisation différée", e);
    }
  });
}

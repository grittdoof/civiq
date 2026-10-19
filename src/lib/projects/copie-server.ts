import type { SupabaseClient } from "@supabase/supabase-js";
import { listeCopie } from "./copie";

// Liste « en copie » applicable (serveur) : celle de la commission si
// elle en a une, sinon celle de la commune.
export async function copiePour(
  service: SupabaseClient,
  communeId: string,
  commissionId: string | null | undefined,
): Promise<string[]> {
  const [{ data: reglages }, commission] = await Promise.all([
    service.from("commune_settings").select("copie_emails").eq("commune_id", communeId).maybeSingle(),
    commissionId
      ? service.from("commissions").select("copie_emails").eq("id", commissionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return listeCopie(
    (reglages?.copie_emails as string[] | null) ?? [],
    (commission.data?.copie_emails as string[] | null | undefined) ?? null,
  );
}

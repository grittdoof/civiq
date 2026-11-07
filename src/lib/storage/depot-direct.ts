import { NextResponse } from "next/server";
import type { createServiceClient } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════
// Dépôt direct dans Supabase Storage (serveur).
//
// Vercel refuse toute requête de plus de 4,5 Mo : un fichier ne
// passe donc plus par nos fonctions. En deux temps :
//   1. « preparer » : droits vérifiés, chemin choisi par le serveur,
//      lien de dépôt signé (valable 2 h, lié à ce seul chemin) ;
//   2. le navigateur envoie le fichier directement à Supabase ;
//   3. « enregistrer » : droits vérifiés à nouveau, chemin contrôlé
//      (préfixe attendu), fichier présent et taille relue côté
//      stockage — jamais celle annoncée par le navigateur.
// Le format et la taille maximale sont aussi imposés par le bucket.
// ═══════════════════════════════════════════════════════════════

type Service = Awaited<ReturnType<typeof createServiceClient>>;

export const MAX_DEPOT_OCTETS = 20 * 1024 * 1024;

export interface DemandePreparer { etape: "preparer"; nom: string; taille: number }
export interface DemandeEnregistrer { etape: "enregistrer"; path: string; nom?: string }

/** Lit le corps JSON d'une demande de dépôt direct (null si multipart). */
export async function lireDemandeDepot(req: Request): Promise<(Record<string, unknown> & { etape: "preparer" | "enregistrer" }) | null> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return null;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || (body.etape !== "preparer" && body.etape !== "enregistrer")) return null;
  return body as Record<string, unknown> & { etape: "preparer" | "enregistrer" };
}

export function extensionDe(nom: string): string {
  return (nom.match(/\.([a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();
}

export const tropLourd = (max = MAX_DEPOT_OCTETS) =>
  NextResponse.json({ error: `Fichier trop volumineux (${Math.round(max / 1024 / 1024)} Mo au maximum).` }, { status: 413 });

/** Étape 1 : lien de dépôt signé pour un chemin choisi par le serveur. */
export async function preparerDepot(service: Service, bucket: string, path: string, contentType: string) {
  const { data, error } = await service.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[depot] lien signé:", error);
    return NextResponse.json({ error: "Le dépôt n'a pas pu être préparé. Réessayez." }, { status: 500 });
  }
  return NextResponse.json({ depot: { bucket, path: data.path, token: data.token, contentType } });
}

/**
 * Étape 3 : vérifie que le fichier déposé est bien sous le préfixe
 * attendu, présent dans le bucket et dans la limite de taille.
 * Un fichier trop lourd est retiré.
 */
export async function verifierDepot(
  service: Service, bucket: string, path: unknown, prefixe: string, max = MAX_DEPOT_OCTETS,
): Promise<{ ok: true; path: string; taille: number } | { ok: false; response: NextResponse }> {
  if (typeof path !== "string" || !path.startsWith(prefixe) || path.includes("..") || path.slice(prefixe.length).includes("/")) {
    return { ok: false, response: NextResponse.json({ error: "Dépôt invalide." }, { status: 400 }) };
  }
  const { data, error } = await service.storage.from(bucket).info(path);
  if (error || !data) {
    return { ok: false, response: NextResponse.json({ error: "Le fichier n'est pas arrivé. Réessayez le dépôt." }, { status: 400 }) };
  }
  const taille = Number(data.size ?? 0);
  if (taille > max) {
    await service.storage.from(bucket).remove([path]);
    return { ok: false, response: tropLourd(max) };
  }
  return { ok: true, path, taille };
}

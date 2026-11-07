"use client";

import { createClient } from "@/lib/supabase-browser";

// ═══════════════════════════════════════════════════════════════
// Téléversement direct (navigateur) : le fichier va droit dans
// Supabase Storage, sans passer par Vercel (limite de 4,5 Mo par
// requête). Voir lib/storage/depot-direct.ts pour le serveur.
// ═══════════════════════════════════════════════════════════════

export const MAX_TELEVERSEMENT_OCTETS = 20 * 1024 * 1024;

/** Lit une réponse, JSON ou non (ex. « Request Entity Too Large » de l'hébergeur). */
export async function lireReponse<T = Record<string, unknown>>(res: Response): Promise<T & { error?: string }> {
  const texte = await res.text().catch(() => "");
  try {
    return JSON.parse(texte) as T & { error?: string };
  } catch {
    const error = res.status === 413 ? "Fichier trop volumineux." :
      res.ok ? "Réponse inattendue du serveur." : `Erreur du serveur (${res.status}). Réessayez dans un instant.`;
    return { error } as T & { error?: string };
  }
}

export interface ResultatTeleversement<T> { ok: boolean; data: T & { error?: string } }

/**
 * Dépose `fichier` via la route `route` (qui accepte les étapes
 * « preparer » et « enregistrer ») ; `champs` accompagne les deux étapes.
 */
export async function televerser<T = Record<string, unknown>>(
  route: string, fichier: File, champs: Record<string, unknown> = {}, max = MAX_TELEVERSEMENT_OCTETS,
): Promise<ResultatTeleversement<T>> {
  const echec = (error: string) => ({ ok: false, data: { error } as T & { error?: string } });
  if (fichier.size > max) return echec(`Fichier trop volumineux (${Math.round(max / 1024 / 1024)} Mo au maximum).`);

  const appel = (corps: Record<string, unknown>) => fetch(route, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps),
  });

  // 1. Lien de dépôt signé (droits, format et taille vérifiés par le serveur).
  let res: Response;
  try { res = await appel({ ...champs, etape: "preparer", nom: fichier.name, taille: fichier.size }); }
  catch { return echec("Connexion impossible. Vérifiez votre accès à Internet."); }
  const prep = await lireReponse<{ depot?: { bucket: string; path: string; token: string; contentType: string } }>(res);
  if (!res.ok || !prep.depot) return echec(prep.error ?? "Le dépôt n'a pas pu être préparé.");

  // 2. Envoi direct au stockage.
  const { bucket, path, token, contentType } = prep.depot;
  const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(path, token, fichier, { contentType });
  if (error) {
    const msg = /size|large|exceed/i.test(error.message) ? "Fichier trop volumineux." :
      /mime|type/i.test(error.message) ? "Format de fichier non accepté." : "L'envoi du fichier a échoué. Réessayez.";
    return echec(msg);
  }

  // 3. Enregistrement de la fiche.
  try { res = await appel({ ...champs, etape: "enregistrer", path, nom: champs.nom ?? fichier.name }); }
  catch { return echec("Connexion impossible. Vérifiez votre accès à Internet."); }
  const data = await lireReponse<T>(res);
  return { ok: res.ok, data };
}

"use client";

import { createTicket, type CreateTicketInput } from "./mutations";
import { deposerPhoto } from "./depot-photo";
import { estErreurReseau } from "./hors-ligne-regles";

// ═══════════════════════════════════════════════════════════════
// Création de signalement hors ligne (lot 3).
//
// Sans réseau, le signalement et ses photos (déjà compressées) sont
// gardés dans IndexedDB sur le téléphone. Au retour du réseau (événement
// « online », réouverture de l'application, Background Sync sur Android
// via public/sw.js), la file est envoyée : photos d'abord, puis le
// signalement. Chaque étape réussie est enregistrée, pour ne jamais
// redéposer une photo déjà envoyée.
// Limite connue : si la connexion tombe pile entre la création et la
// confirmation, le signalement peut être créé deux fois.
// ═══════════════════════════════════════════════════════════════

export const EVENEMENT_FILE = "civiq:file-tickets";
const BASE = "gociviq-hors-ligne";
const TABLE = "tickets";

export interface TicketEnAttente {
  id: string;
  cree_le: string;
  communeId: string;
  titre: string;
  donnees: CreateTicketInput;
  /** Photos encore à déposer (compressées). */
  photos: Blob[];
  tentatives: number;
  erreur?: string;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(TABLE)) req.result.createObjectStore(TABLE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operation<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, mode);
    const req = f(tx.objectStore(TABLE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const prevenir = () => window.dispatchEvent(new CustomEvent(EVENEMENT_FILE));

export async function listerEnAttente(): Promise<TicketEnAttente[]> {
  if (typeof indexedDB === "undefined") return [];
  const tous = await operation<TicketEnAttente[]>("readonly", (s) => s.getAll() as IDBRequest<TicketEnAttente[]>);
  return tous.sort((a, b) => a.cree_le.localeCompare(b.cree_le));
}

export async function mettreEnFile(communeId: string, donnees: CreateTicketInput, photos: Blob[]): Promise<void> {
  const item: TicketEnAttente = {
    id: crypto.randomUUID(), cree_le: new Date().toISOString(), communeId,
    titre: donnees.titre, donnees, photos, tentatives: 0,
  };
  await operation("readwrite", (s) => s.put(item));
  prevenir();
  // Android / Chromium : réveil du service worker au retour du réseau
  try {
    const reg = await navigator.serviceWorker?.ready;
    await (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register("tickets-flush-queue");
  } catch { /* pas de Background Sync (iOS) : envoi à l'ouverture et au retour en ligne */ }
}

async function enregistrer(item: TicketEnAttente) { await operation("readwrite", (s) => s.put(item)); }
async function retirer(id: string) { await operation("readwrite", (s) => s.delete(id)); }

let envoiEnCours: Promise<{ envoyes: number; restants: number }> | null = null;

/** Envoie la file ; un seul envoi à la fois. */
export function envoyerFile(): Promise<{ envoyes: number; restants: number }> {
  if (envoiEnCours) return envoiEnCours;
  envoiEnCours = (async () => {
    let envoyes = 0;
    const items = await listerEnAttente();
    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        // Photos une par une, progression enregistrée
        while (item.photos.length > 0) {
          const chemin = await deposerPhoto(item.communeId, item.photos[0]);
          item.donnees = { ...item.donnees, photo_paths: [...(item.donnees.photo_paths ?? []), chemin] };
          item.photos = item.photos.slice(1);
          await enregistrer(item);
        }
        await createTicket(item.donnees);
        await retirer(item.id);
        envoyes++;
      } catch (e) {
        if (estErreurReseau(e, navigator.onLine)) break;
        item.tentatives += 1;
        item.erreur = e instanceof Error ? e.message : "Envoi refusé";
        await enregistrer(item);
      }
    }
    prevenir();
    return { envoyes, restants: (await listerEnAttente()).length };
  })().finally(() => { envoiEnCours = null; });
  return envoiEnCours;
}

/** Abandonne un signalement en attente (refusé par le serveur, par exemple). */
export async function abandonner(id: string): Promise<void> {
  await retirer(id);
  prevenir();
}

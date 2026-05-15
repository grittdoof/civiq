# Background Sync — création de ticket offline

> Permet à un élu / agent sur le terrain de créer un ticket même
> sans réseau. Le ticket est mis en file d'attente locale et envoyé
> automatiquement dès que la connexion revient.

## Architecture

```
1. User clique "Créer le ticket" hors-ligne
        ↓
2. Le client tente fetch POST /api/tickets → échec réseau
        ↓
3. Fallback : enqueue dans IndexedDB (object store "ticketsQueue")
        ↓
4. registration.sync.register("tickets-flush-queue")
        ↓
        ── Réseau revient ──
        ↓
5. Browser réveille le SW (event "sync" avec tag "tickets-flush-queue")
        ↓
6. SW envoie postMessage("flush-tickets-queue") aux clients ouverts
        ↓
7. Le client React rejoue les requêtes en attente depuis IndexedDB
```

## Compatibilité

| Plateforme | Background Sync API | Fallback recommandé |
|---|---|---|
| Chrome Android | ✓ natif | — |
| Chrome desktop | ✓ natif | — |
| Firefox Android | ✗ (Bug 1257634) | Replay à l'ouverture suivante de l'app |
| Safari iOS | ✗ | Replay à l'ouverture suivante |

→ **Stratégie** : SW + Background Sync sur les plateformes qui le supportent, + replay à la reprise du focus comme filet de sécurité universel.

## Implémentation

### Côté Service Worker (déjà fait — `public/sw.js`)

```js
self.addEventListener("sync", (event) => {
  if (event.tag === "tickets-flush-queue") {
    event.waitUntil(flushTicketsQueue());
  }
});

async function flushTicketsQueue() {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const c of clients) {
    c.postMessage({ type: "flush-tickets-queue" });
  }
}
```

### Côté client (à implémenter — `src/lib/tickets/offline-queue.ts`)

```ts
import { openDB } from "idb"; // npm i idb

const DB_NAME = "gociviq";
const STORE = "ticketsQueue";

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    },
  });
}

export interface QueuedTicket {
  id?: number;
  payload: Record<string, unknown>;
  createdAt: number;
}

export async function enqueueTicket(payload: Record<string, unknown>) {
  const db = await getDB();
  await db.add(STORE, { payload, createdAt: Date.now() });
  // Background Sync
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const reg = await navigator.serviceWorker.ready;
    try {
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync.register("tickets-flush-queue");
    } catch { /* fallback : replay à l'ouverture */ }
  }
}

export async function flushQueue(submit: (payload: Record<string, unknown>) => Promise<boolean>) {
  const db = await getDB();
  const all = await db.getAll(STORE) as QueuedTicket[];
  for (const item of all) {
    try {
      const ok = await submit(item.payload);
      if (ok) await db.delete(STORE, item.id!);
    } catch {
      // garder en queue, retry plus tard
    }
  }
}
```

### Hook React qui écoute le SW + le focus

```ts
"use client";
import { useEffect } from "react";
import { flushQueue } from "@/lib/tickets/offline-queue";

export function useOfflineQueueFlusher() {
  useEffect(() => {
    const submit = async (payload: Record<string, unknown>) => {
      const r = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return r.ok;
    };

    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "flush-tickets-queue") flushQueue(submit);
    };
    const onFocus = () => flushQueue(submit);

    navigator.serviceWorker?.addEventListener("message", onMsg);
    window.addEventListener("focus", onFocus);
    onFocus(); // au mount

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
```

## V2 (non livré dans cet audit)

Pour finaliser le Background Sync en prod, il faudra :

1. `npm install idb`
2. Créer `src/lib/tickets/offline-queue.ts` (cf. plus haut)
3. Modifier le formulaire `/admin/tickets/nouveau` : sur erreur réseau,
   appeler `enqueueTicket(payload)` au lieu d'afficher une erreur
4. Monter `useOfflineQueueFlusher()` dans `AdminShell`
5. Ajouter un bandeau « X ticket(s) en attente d'envoi » dans le header
   pour signaler à l'agent qu'il a des données non synchronisées

L'effort estimé est ~2 jours dev + tests sur vrai téléphone en mode avion.

// ═══════════════════════════════════════════════════════════════
// Service Worker — GoCiviq (v4)
//
// Stratégies :
//   • Navigation HTML → network-first + fallback /offline.html
//   • Assets statiques (/brand, /favicon, /app-icon, fonts) → cache-first
//   • API & mutations → network-only (jamais cache)
//   • Push notifications → showNotification + click deep-link
//   • Background sync (Android) → file d'attente pour création ticket offline
// ═══════════════════════════════════════════════════════════════

const SW_VERSION = "v5";
const STATIC_CACHE = `gociviq-static-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/brand/coq-couleur.svg",
  "/favicon/favicon.svg",
  "/manifest.webmanifest",
  "/app-icon/icon-192.png",
  "/app-icon/notification-badge.png",
];

// ── INSTALL : précache des ressources de fallback ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // addAll échoue tout-ou-rien : on filtre les 404 pour éviter de bloquer
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
      await self.skipWaiting();
    })()
  );
});

// ── ACTIVATE : purge des vieux caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("gociviq-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ── FETCH : routing des stratégies ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hors GET → on laisse passer (POST mutations, etc.)
  if (request.method !== "GET") return;

  // Cross-origin : pas notre problème
  if (url.origin !== self.location.origin) return;

  // 1. Navigation HTML : network-first avec fallback offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  // 2. Assets statiques (brand, favicon, app-icon, manifest) : cache-first
  if (
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/favicon/") ||
    url.pathname.startsWith("/app-icon/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 3. API : toujours network (pas de cache pour les données)
  if (url.pathname.startsWith("/api/")) {
    return; // navigateur fait son boulot normalement
  }
});

async function networkFirstHtml(request) {
  try {
    const fresh = await fetch(request);
    return fresh;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline ?? new Response("Hors connexion", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return cached ?? new Response("", { status: 504 });
  }
}

// ═══════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); }
  catch { payload = { title: "GoCiviq", body: event.data.text() }; }

  const title = payload.title || "GoCiviq";
  const options = {
    body: payload.body || "",
    // PNG obligatoire : iOS PWA n'affiche pas les SVG en notification
    icon: "/app-icon/icon-192.png",
    badge: "/app-icon/notification-badge.png",
    tag: payload.tag,
    data: { url: payload.url || "/", swVersion: SW_VERSION },
    renotify: false,
    requireInteraction: false,
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: "navigate", url: target });
          return;
        }
      } catch { /* ignore */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

// ═══════════════════════════════════════════════════════════════
// BACKGROUND SYNC (Android, Chromium) — création ticket offline
//
// Côté client : si POST /api/tickets/offline-queue échoue,
// le client enregistre la requête dans IndexedDB et déclenche
// `await registration.sync.register("tickets-flush-queue")`.
// Le SW se réveille quand le réseau revient.
// ═══════════════════════════════════════════════════════════════

self.addEventListener("sync", (event) => {
  if (event.tag === "tickets-flush-queue") {
    event.waitUntil(flushTicketsQueue());
  }
});

async function flushTicketsQueue() {
  // Implémentation V1 : envoie un message aux clients ouverts pour
  // qu'ils rejouent leur file d'attente eux-mêmes (où l'IndexedDB
  // applicative vit déjà). Le SW n'a pas besoin de connaître la
  // structure du payload.
  const clients = await self.clients.matchAll({ type: "window" });
  for (const c of clients) {
    c.postMessage({ type: "flush-tickets-queue" });
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGES depuis le client (skipWaiting bouton "Mettre à jour")
// ═══════════════════════════════════════════════════════════════
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.SW_TAG = `gociviq-${SW_VERSION}`;

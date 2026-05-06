// ═══════════════════════════════════════════════════════════════
// Service Worker — GoCiviq
//
// Gère :
//  • réception d'événements push (notifications du module Tickets)
//  • clic sur la notification (focus tab existante ou nouvelle)
// ═══════════════════════════════════════════════════════════════

self.addEventListener("install", (event) => {
  // Activation immédiate sans attendre la fermeture des autres onglets
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "GoCiviq", body: event.data.text() };
  }

  const title = payload.title || "GoCiviq";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-badge.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    requireInteraction: false,
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Chercher un onglet déjà ouvert sur le même origin
      for (const client of all) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          // Naviguer si pas déjà sur la bonne page
          if (!client.url.endsWith(target)) {
            client.navigate(target).catch(() => {
              // Fallback : postMessage pour que le client gère lui-même
              client.postMessage({ type: "navigate", url: target });
            });
          }
          return;
        }
      }
      // Aucun onglet ouvert → en ouvrir un
      await self.clients.openWindow(target);
    })()
  );
});

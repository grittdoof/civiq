// ═══════════════════════════════════════════════════════════════
// Service Worker — GoCiviq
//
//   • Réception d'événements push (notifications Tickets)
//   • Clic sur notification : focus tab existante OU ouvre tab
//     + deep link vers le ticket via postMessage (le client gère
//     la navigation côté React Router pour éviter un full reload)
//
// Version explicite pour permettre des rolling updates contrôlés.
// ═══════════════════════════════════════════════════════════════

const SW_VERSION = "v3";
const SW_TAG = `gociviq-${SW_VERSION}`;

self.addEventListener("install", () => {
  // Activation immédiate (skipWaiting) — le client peut basculer
  // sur la nouvelle version sans attendre la fermeture des autres tabs
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Reprend le contrôle des clients déjà ouverts (sans reload)
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "GoCiviq", body: event.data.text() };
  }

  const title = payload.title || "GoCiviq";
  const options = {
    body: payload.body || "",
    // Icônes utilisent les SVG existants (Chrome/Firefox/Android les acceptent)
    icon: "/favicon/favicon.svg",
    badge: "/favicon/favicon.svg",
    tag: payload.tag,                       // fusionne les notifs identiques
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

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1. Chercher un client déjà ouvert sur le même origin
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            // Le client React écoute "message" et navigue via router.push
            // (cf. usePushNavigationListener côté browser)
            client.postMessage({ type: "navigate", url: target });
            return;
          }
        } catch {
          /* ignore parse errors */
        }
      }

      // 2. Aucun client ouvert → ouvre une nouvelle fenêtre directement sur target
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

// Permet au client de demander un skipWaiting via postMessage
// (utile si on affiche un bandeau "Nouvelle version dispo, recharger")
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Tag exposé pour debug
self.SW_TAG = SW_TAG;

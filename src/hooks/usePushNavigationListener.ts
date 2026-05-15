"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
// usePushNavigationListener
//
// Écoute les messages envoyés par le Service Worker lors d'un
// clic sur notification push (cf. public/sw.js → notificationclick
// → postMessage({ type: "navigate", url })).
//
// Permet une navigation client-side fluide via router.push, sans
// reload complet du document.
// ═══════════════════════════════════════════════════════════════

export function usePushNavigationListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== "navigate" || !data.url) return;
      try {
        // Sécurité : on n'autorise que les URLs internes
        if (data.url.startsWith("/")) {
          router.push(data.url);
        }
      } catch {
        /* ignore */
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [router]);
}

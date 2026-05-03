"use client";

import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════
// Hook usePushSubscription
//
// Gère l'enregistrement Service Worker + la souscription Web Push,
// le tout avec détection iOS et gestion du « pas encore en PWA ».
//
// API exposée :
//   - status: "loading" | "supported" | "ios-pwa-required" | "denied"
//             | "unsupported" | "subscribed"
//   - subscribe(): Promise<boolean>
//   - unsubscribe(): Promise<boolean>
// ═══════════════════════════════════════════════════════════════

export type PushStatus =
  | "loading"
  | "unsupported"        // Navigator ne supporte pas Push API
  | "ios-pwa-required"   // iOS Safari hors PWA — exige ajout à l'écran d'accueil
  | "denied"             // Permission refusée
  | "supported"          // Possible mais pas souscrit
  | "subscribed";        // Déjà souscrit

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return buffer;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // PWA installée (Apple) ou affichée en standalone (Android/desktop)
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // iOS hors PWA : pas de Push API → on guide l'user à installer
      if (isIos() && !isStandalone()) {
        setStatus("ios-pwa-required");
      } else {
        setStatus("unsupported");
      }
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        setStatus("supported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setStatus("subscribed");
        setEndpoint(sub.endpoint);
      } else {
        setStatus("supported");
      }
    } catch (err) {
      console.error("[push] checkStatus error", err);
      setStatus("supported");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!vapidPublicKey) {
      console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante");
      return false;
    }
    try {
      // 1. Demander la permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return false;
      }
      // 2. Enregistrer le SW
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // 3. Souscrire
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      // 4. Envoyer au serveur
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("Échec enregistrement souscription");

      setStatus("subscribed");
      setEndpoint(sub.endpoint);
      return true;
    } catch (err) {
      console.error("[push] subscribe error", err);
      return false;
    }
  }, [vapidPublicKey]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        setStatus("supported");
        return true;
      }
      await fetch(`/api/push/unsubscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
        method: "DELETE",
      }).catch(() => {});
      await sub.unsubscribe();
      setStatus("supported");
      setEndpoint(null);
      return true;
    } catch (err) {
      console.error("[push] unsubscribe error", err);
      return false;
    }
  }, []);

  return { status, endpoint, subscribe, unsubscribe, refresh: checkStatus };
}

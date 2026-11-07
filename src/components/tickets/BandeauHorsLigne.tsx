"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { EVENEMENT_FILE, abandonner, envoyerFile, listerEnAttente, type TicketEnAttente } from "@/lib/tickets/hors-ligne";
import { libelleFile } from "@/lib/tickets/hors-ligne-regles";

// ═══════════════════════════════════════════════════════════════
// Bandeau « hors ligne » et envoi automatique de la file (lot 3).
// Monté dans le shell : envoie la file à l'ouverture, au retour du
// réseau, quand l'application revient au premier plan et sur message
// du service worker (Background Sync). N'affiche rien s'il n'y a ni
// file ni coupure.
// ═══════════════════════════════════════════════════════════════

export default function BandeauHorsLigne() {
  const router = useRouter();
  const [items, setItems] = useState<TicketEnAttente[]>([]);
  const [enLigne, setEnLigne] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const relire = useCallback(() => { listerEnAttente().then(setItems).catch(() => setItems([])); }, []);

  const envoyer = useCallback(async () => {
    if (!navigator.onLine) return;
    setEnvoi(true);
    try {
      const { envoyes } = await envoyerFile();
      if (envoyes > 0) router.refresh();
    } catch { /* réessai plus tard */ }
    setEnvoi(false);
    relire();
  }, [router, relire]);

  useEffect(() => {
    setEnLigne(navigator.onLine);
    relire();
    void envoyer();
    const enLigneOui = () => { setEnLigne(true); void envoyer(); };
    const enLigneNon = () => setEnLigne(false);
    const visible = () => { if (document.visibilityState === "visible") void envoyer(); };
    const message = (e: MessageEvent) => { if (e.data?.type === "flush-tickets-queue") void envoyer(); };
    window.addEventListener("online", enLigneOui);
    window.addEventListener("offline", enLigneNon);
    window.addEventListener(EVENEMENT_FILE, relire);
    document.addEventListener("visibilitychange", visible);
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      window.removeEventListener("online", enLigneOui);
      window.removeEventListener("offline", enLigneNon);
      window.removeEventListener(EVENEMENT_FILE, relire);
      document.removeEventListener("visibilitychange", visible);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [envoyer, relire]);

  const libelle = libelleFile(items.length, enLigne);
  const refuses = items.filter((i) => i.erreur);
  if (!libelle) return null;

  return (
    <div className="tk-hors-ligne" role="status" aria-live="polite">
      <CloudOff size={16} aria-hidden="true" />
      <span>{libelle}</span>
      {enLigne && items.length > 0 && (
        <button type="button" onClick={envoyer} disabled={envoi}>
          {envoi ? <Loader2 size={13} className="civiq-spin" /> : <RefreshCw size={13} />} Envoyer maintenant
        </button>
      )}
      {refuses.map((r) => (
        <p key={r.id} style={{ flexBasis: "100%", margin: 0, fontWeight: 500 }}>
          « {r.titre} » refusé : {r.erreur}{" "}
          <button type="button" onClick={() => abandonner(r.id)} style={{ marginLeft: 6 }}>Abandonner</button>
        </p>
      ))}
    </div>
  );
}

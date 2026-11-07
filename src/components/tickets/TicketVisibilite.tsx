"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { changerServiceTicket, modifierVisibiliteTicket } from "@/lib/tickets/mutations";
import { CONFIDENTIALITE_AIDE, CONFIDENTIALITE_LABELS, type Confidentialite } from "@/lib/tickets/droits";
import VisibiliteChamps, { type Personne } from "./VisibiliteChamps";

// ═══════════════════════════════════════════════════════════════
// Carte « Service et visibilité » de la fiche signalement (lot 1).
// ═══════════════════════════════════════════════════════════════

const h2: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", margin: 0 };

export default function TicketVisibilite({
  ticketId, serviceId, services, niveau, destinataires, personnes, moi,
  peutChangerService, peutChangerVisibilite,
}: {
  ticketId: string;
  serviceId: string | null;
  services: Array<{ id: string; nom: string }>;
  niveau: Confidentialite;
  destinataires: Personne[];
  personnes: Personne[];
  moi: string;
  peutChangerService: boolean;
  peutChangerVisibilite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [edition, setEdition] = useState(false);
  const [n, setN] = useState<Confidentialite>(niveau);
  const [dest, setDest] = useState<string[]>(destinataires.map((d) => d.id));

  const nomService = services.find((s) => s.id === serviceId)?.nom ?? null;

  function changerService(id: string) {
    setErr(null);
    startTransition(async () => {
      try { await changerServiceTicket(ticketId, id || null); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    });
  }

  function enregistrer() {
    setErr(null);
    startTransition(async () => {
      try {
        await modifierVisibiliteTicket(ticketId, n, n === "standard" ? [] : dest);
        setEdition(false);
        router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    });
  }

  return (
    <div className="civiq-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, borderColor: niveau !== "standard" ? "var(--marine)" : undefined }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h2 style={h2}>Service</h2>
        {peutChangerService && services.length > 0 ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="tk-sr-only">Service qui traite le signalement</span>
            <select
              value={serviceId ?? ""}
              disabled={pending}
              onChange={(e) => changerService(e.target.value)}
              style={{ height: 40, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", padding: "0 10px", font: "inherit", fontSize: 13.5, background: "var(--bg-card, #fff)" }}
            >
              <option value="">Aucun service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5 }}>{nomService ?? "Aucun service"}</p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h2 style={h2}>Visibilité</h2>
        {!edition ? (
          <>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, color: niveau !== "standard" ? "var(--marine)" : "var(--fg)" }}>
              {niveau !== "standard" && <Lock size={14} aria-hidden="true" />}
              {CONFIDENTIALITE_LABELS[niveau]}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>{CONFIDENTIALITE_AIDE[niveau]}</p>
            {destinataires.length > 0 && (
              <p style={{ margin: 0, fontSize: 13 }}>
                <strong>Destinataires :</strong> {destinataires.map((d) => d.full_name ?? "Sans nom").join(", ")}
              </p>
            )}
            {peutChangerVisibilite && (
              <button type="button" className="civiq-btn civiq-btn-outline" onClick={() => setEdition(true)} style={{ justifyContent: "center", fontSize: 13, padding: "8px 12px", marginTop: 4 }}>
                Modifier la visibilité
              </button>
            )}
          </>
        ) : (
          <>
            <VisibiliteChamps niveau={n} destinataires={dest} personnes={personnes} moi={moi} onNiveau={setN} onDestinataires={setDest} nom={`visibilite-${ticketId}`} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="civiq-btn civiq-btn-default" disabled={pending || (n !== "standard" && dest.length === 0)} onClick={enregistrer} style={{ flex: 1, justifyContent: "center", fontSize: 13 }}>
                {pending && <Loader2 size={14} className="civiq-spin" />} Enregistrer
              </button>
              <button type="button" className="civiq-btn civiq-btn-outline" disabled={pending} onClick={() => { setEdition(false); setN(niveau); setDest(destinataires.map((d) => d.id)); }} style={{ justifyContent: "center", fontSize: 13 }}>
                Annuler
              </button>
            </div>
          </>
        )}
      </div>

      {err && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--destructive)" }}>{err}</p>}
    </div>
  );
}

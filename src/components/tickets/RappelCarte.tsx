"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Download, FileText, Loader2, Paperclip } from "lucide-react";
import { modifierRappel } from "@/lib/tickets/mutations";
import { AVANCES, aujourdhuiParis, dateDeclenchement, formatJour, libelleAvance, type Repetition } from "@/lib/tickets/rappels";
import { televerser } from "@/lib/storage/televerser";
import { ACCEPT_DOCUMENT_RAPPORT } from "@/lib/tickets/documents-rapport";

// ═══════════════════════════════════════════════════════════════
// Fiche d'un ticket de rappel : échéance, anticipation, répétition
// (modifiables tant qu'il n'est pas parti) et pièces jointes.
// ═══════════════════════════════════════════════════════════════

export interface PieceTicket { nom: string; url: string | null; telechargement: string; ouvrir: boolean }

const champ: React.CSSProperties = { width: "100%", minHeight: 40, borderRadius: 8, border: "1px solid var(--border)", padding: "0 10px", font: "inherit", fontSize: 13.5, background: "var(--card, #fff)" };
const h2: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 };

export default function RappelCarte({
  ticketId, rappelLe, avance, repetition, envoyeLe, programme, peutModifier, pieces,
}: {
  ticketId: string;
  rappelLe: string;
  avance: number;
  repetition: Repetition;
  envoyeLe: string | null;
  programme: boolean;
  peutModifier: boolean;
  pieces: PieceTicket[];
}) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [date, setDate] = useState(rappelLe);
  const [av, setAv] = useState(avance);
  const [annuel, setAnnuel] = useState(repetition === "annuelle");
  const [occupe, setOccupe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function enregistrer() {
    setErr(null); setOccupe("Enregistrement…");
    try {
      await modifierRappel(ticketId, { rappel_le: date, avance_jours: av, repetition: annuel ? "annuelle" : "aucune" });
      setEdition(false); router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setOccupe(null); }
  }

  async function ajouter(fichiers: File[]) {
    setErr(null);
    for (const [i, f] of fichiers.entries()) {
      setOccupe(`Envoi ${i + 1}/${fichiers.length}…`);
      const r = await televerser("/api/tickets/upload-document", f, { ticket_id: ticketId, cible: "ticket" });
      if (!r.ok) { setErr(`${f.name} : ${r.data.error ?? "envoi impossible"}`); break; }
    }
    setOccupe(null); router.refresh();
  }

  return (
    <div className="civiq-card" style={{ padding: 14, borderColor: programme ? "var(--accent)" : undefined }}>
      <h2 style={h2}><BellRing size={13} aria-hidden="true" /> Rappel</h2>
      {!edition ? (
        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
          <p style={{ margin: 0 }}>Échéance : <strong>{formatJour(rappelLe)}</strong></p>
          <p style={{ margin: 0 }}>Prévenir : {libelleAvance(avance).toLowerCase()}{repetition === "annuelle" ? " · chaque année" : ""}</p>
          <p style={{ margin: 0, color: programme ? "var(--accent)" : "var(--fg-muted)", fontWeight: 600 }}>
            {programme
              ? `Programmé : part le ${formatJour(dateDeclenchement(rappelLe, avance))}`
              : envoyeLe ? `Parti le ${new Date(envoyeLe).toLocaleDateString("fr-FR")}` : "Rappel clôturé"}
          </p>
          {programme && peutModifier && (
            <button type="button" className="civiq-btn civiq-btn-outline" onClick={() => setEdition(true)} style={{ fontSize: 13, marginTop: 4 }}>
              Modifier la date
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600 }}>Échéance
            <input type="date" style={champ} value={date} min={aujourdhuiParis()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label style={{ fontSize: 12.5, fontWeight: 600 }}>Prévenir
            <select style={champ} value={av} onChange={(e) => setAv(Number(e.target.value))}>
              {AVANCES.map((a) => <option key={a.jours} value={a.jours}>{a.libelle}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={annuel} onChange={(e) => setAnnuel(e.target.checked)} style={{ width: 18, height: 18 }} /> Répéter chaque année
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="civiq-btn civiq-btn-default" onClick={enregistrer} disabled={!!occupe || !date} style={{ fontSize: 13 }}>
              {occupe && <Loader2 size={14} className="civiq-spin" />} Enregistrer
            </button>
            <button type="button" className="civiq-btn civiq-btn-ghost" onClick={() => setEdition(false)} style={{ fontSize: 13 }}>Annuler</button>
          </div>
        </div>
      )}

      <h2 style={{ ...h2, marginTop: 14 }}><Paperclip size={13} aria-hidden="true" /> Pièces jointes</h2>
      {pieces.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-muted)" }}>Aucune pièce jointe.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
          {pieces.map((p) => (
            <li key={p.nom} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <FileText size={14} aria-hidden="true" style={{ flexShrink: 0, color: "var(--fg-muted)" }} />
              {p.url ? (
                <a href={p.ouvrir ? p.url : p.telechargement} target={p.ouvrir ? "_blank" : undefined} rel="noreferrer" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nom}</a>
              ) : <span style={{ flex: 1, color: "var(--fg-muted)" }}>{p.nom} (indisponible)</span>}
              {p.url && <a href={p.telechargement} aria-label={`Télécharger ${p.nom}`} style={{ color: "var(--fg-muted)" }}><Download size={14} /></a>}
            </li>
          ))}
        </ul>
      )}
      {peutModifier && (
        <label className="civiq-btn civiq-btn-outline" style={{ fontSize: 13, marginTop: 10, cursor: "pointer", display: "inline-flex" }}>
          {occupe && !edition ? <><Loader2 size={14} className="civiq-spin" /> {occupe}</> : <><Paperclip size={14} /> Ajouter un document</>}
          <input type="file" multiple accept={ACCEPT_DOCUMENT_RAPPORT} style={{ display: "none" }} disabled={!!occupe}
            onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) ajouter(l); }} />
        </label>
      )}
      {err && <p role="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--destructive)" }}>{err}</p>}
    </div>
  );
}

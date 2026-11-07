"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, CheckCircle2, Loader2, Lock, MapPin, X } from "lucide-react";
import { updateTicket, updateTicketStatus } from "@/lib/tickets/mutations";
import { URGENCE_COLORS, type Urgence } from "@/lib/tickets/categories";
import type { ActionRapide } from "@/lib/tickets/interventions";
import TicketPhotoUpload from "./TicketPhotoUpload";

// ═══════════════════════════════════════════════════════════════
// Ligne de la liste « Mes interventions » (lot 3, maquette 1A) :
// barre de couleur d'urgence, puces, titre, lieu, et une action
// rapide à droite (prendre en charge, clôturer, ajouter une photo).
// ═══════════════════════════════════════════════════════════════

export interface DonneesLigne {
  id: string;
  numero: number;
  titre: string;
  lieu: string | null;
  categorie: string | null;
  age: string;
  urgence: Urgence;
  puces: Array<{ texte: string; ton: "info" | "ok" | "alerte" | "danger" | "neutre" }>;
  confidentialite: "standard" | "restreint" | "confidentiel";
  miniature: string | null;
  action: ActionRapide;
}

const TONS = {
  info: { bg: "#EAF1FE", fg: "#1a55b8" },
  ok: { bg: "#E7F7EC", fg: "#13693A" },
  alerte: { bg: "#FEF3E2", fg: "#7A4B00" },
  danger: { bg: "#FDE7E9", fg: "#B0000F" },
  neutre: { bg: "var(--border-light)", fg: "var(--fg-muted)" },
} as const;

export default function LigneIntervention({ t, communeId }: { t: DonneesLigne; communeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [chemins, setChemins] = useState<string[]>([]);
  const barre = t.urgence === "danger_immediat" ? "#E00114" : t.urgence === "urgente" ? "#E08A00" : t.urgence === "faible" ? "#9CA1A9" : URGENCE_COLORS.normale.fg;

  function prendre() {
    setErr(null);
    startTransition(async () => {
      try { await updateTicketStatus(t.id, "pris_en_charge"); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    });
  }

  function envoyerPhotos() {
    if (chemins.length === 0) return;
    setErr(null);
    startTransition(async () => {
      try {
        await updateTicket({ ticketId: t.id, new_photo_paths: chemins });
        setPhotoOuverte(false); setChemins([]); router.refresh();
      } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); }
    });
  }

  return (
    <li className="tk-ligne" data-urgence={t.urgence}>
      <span className="tk-ligne-barre" style={{ background: barre }} aria-hidden="true" />
      <Link href={`/admin/tickets/${t.id}`} className="tk-ligne-corps">
        {t.miniature && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.miniature} alt="" className="tk-ligne-vignette" loading="lazy" decoding="async" />
        )}
        <span className="tk-ligne-texte">
          {(t.puces.length > 0 || t.confidentialite !== "standard") && (
            <span className="tk-ligne-puces">
              {t.confidentialite !== "standard" && (
                <span className="tk-ligne-puce" style={{ background: "var(--marine)", color: "#fff" }}>
                  <Lock size={10} aria-hidden="true" /> {t.confidentialite === "restreint" ? "Restreint" : "Confidentiel"}
                </span>
              )}
              {t.puces.map((p) => (
                <span key={p.texte} className="tk-ligne-puce" style={{ background: TONS[p.ton].bg, color: TONS[p.ton].fg }}>{p.texte}</span>
              ))}
            </span>
          )}
          <span className="tk-ligne-titre"><span className="tk-ligne-num">#{t.numero}</span> {t.titre}</span>
          <span className="tk-ligne-meta">
            {t.lieu && <span><MapPin size={11} aria-hidden="true" /> {t.lieu}</span>}
            {t.categorie && <span>{t.categorie}</span>}
            <span>{t.age}</span>
          </span>
        </span>
      </Link>

      {t.action === "prendre" && (
        <button type="button" className="tk-ligne-action" onClick={prendre} disabled={pending} aria-label={`Prendre en charge le ticket ${t.numero}`}>
          {pending ? <Loader2 size={18} className="civiq-spin" /> : <Check size={20} strokeWidth={2.4} />}
          <span>Prendre</span>
        </button>
      )}
      {t.action === "cloturer" && (
        <Link href={`/admin/tickets/${t.id}/cloturer`} className="tk-ligne-action" aria-label={`Clôturer le ticket ${t.numero}`}>
          <CheckCircle2 size={20} /><span>Clôturer</span>
        </Link>
      )}
      {t.action === "photo" && (
        <button type="button" className="tk-ligne-action" onClick={() => setPhotoOuverte(true)} aria-label={`Ajouter une photo au ticket ${t.numero}`}>
          <Camera size={20} /><span>Photo</span>
        </button>
      )}

      {err && <p role="alert" className="tk-ligne-erreur">{err}</p>}

      {photoOuverte && (
        <div className="tk-sheet-backdrop" role="dialog" aria-modal="true" aria-label={`Ajouter des photos au ticket ${t.numero}`} onClick={() => setPhotoOuverte(false)}>
          <div className="tk-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="tk-sheet-handle" />
            <div className="tk-sheet-header">
              <h3>Photos · #{t.numero}</h3>
              <button type="button" onClick={() => setPhotoOuverte(false)} className="tk-wizard-iconbtn" aria-label="Fermer"><X size={18} /></button>
            </div>
            <div className="tk-sheet-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <TicketPhotoUpload communeId={communeId} onChange={setChemins} max={5} />
              <button type="button" className="civiq-btn civiq-btn-default" onClick={envoyerPhotos} disabled={pending || chemins.length === 0} style={{ justifyContent: "center" }}>
                {pending && <Loader2 size={16} className="civiq-spin" />} Ajouter {chemins.length > 0 ? `${chemins.length} photo${chemins.length > 1 ? "s" : ""}` : "les photos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

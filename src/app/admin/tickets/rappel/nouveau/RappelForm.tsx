"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellRing, Loader2, Paperclip, X } from "lucide-react";
import { creerRappel } from "@/lib/tickets/mutations";
import { AVANCES, aujourdhuiParis, dateDeclenchement, formatJour } from "@/lib/tickets/rappels";
import { televerser } from "@/lib/storage/televerser";
import { ACCEPT_DOCUMENT_RAPPORT } from "@/lib/tickets/documents-rapport";
import { FONCTION_LABEL } from "@/lib/profils/fonctions";

// ═══════════════════════════════════════════════════════════════
// Programmer un rappel : un ticket qui s'ouvre à une date choisie
// et prévient les personnes concernées.
// ═══════════════════════════════════════════════════════════════

interface Personne { id: string; full_name: string | null; job_title: string | null }

const champ: React.CSSProperties = { width: "100%", minHeight: 46, borderRadius: 10, border: "1px solid var(--border)", padding: "0 12px", font: "inherit", fontSize: 15, background: "var(--card, #fff)" };

export default function RappelForm({ personnes, moi, nomService }: { personnes: Personne[]; moi: string; nomService: string | null }) {
  const router = useRouter();
  const aujourdhui = aujourdhuiParis();
  const [titre, setTitre] = useState("");
  const [rappelLe, setRappelLe] = useState("");
  const [avance, setAvance] = useState(30);
  const [annuel, setAnnuel] = useState(false);
  const [note, setNote] = useState("");
  const [choisis, setChoisis] = useState<string[]>([]);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [etat, setEtat] = useState<"repos" | "envoi">("repos");
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apres, setApres] = useState<{ id: string; erreurs: string[] } | null>(null);

  const autres = personnes.filter((p) => p.id !== moi);
  const declenchement = rappelLe ? dateDeclenchement(rappelLe, avance) : null;
  const valide = titre.trim().length >= 3 && !!rappelLe && rappelLe >= aujourdhui;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!valide) return;
    setErreur(null); setEtat("envoi"); setProgression("Création du rappel…");
    try {
      const { id } = await creerRappel({
        titre, description: note || null, rappel_le: rappelLe, avance_jours: avance,
        repetition: annuel ? "annuelle" : "aucune", destinataire_ids: choisis,
      });
      const erreurs: string[] = [];
      for (const [i, f] of fichiers.entries()) {
        setProgression(`Envoi des pièces jointes (${i + 1}/${fichiers.length})…`);
        const r = await televerser("/api/tickets/upload-document", f, { ticket_id: id, cible: "ticket" });
        if (!r.ok) erreurs.push(`${f.name} : ${r.data.error ?? "envoi impossible"}`);
      }
      if (erreurs.length > 0) { setApres({ id, erreurs }); setEtat("repos"); return; }
      router.push(`/admin/tickets/${id}`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Création impossible");
      setEtat("repos");
    } finally {
      setProgression(null);
    }
  }

  if (apres) {
    return (
      <main className="civiq-main" style={{ maxWidth: 640 }}>
        <h1 className="civiq-page-title">Rappel programmé</h1>
        <p role="alert" style={{ fontSize: 14.5, lineHeight: 1.55 }}>Certaines pièces jointes n&apos;ont pas pu être envoyées :</p>
        <ul style={{ fontSize: 14, color: "var(--destructive)" }}>{apres.erreurs.map((x) => <li key={x}>{x}</li>)}</ul>
        <p style={{ fontSize: 14 }}>Vous pourrez les ajouter depuis le ticket.</p>
        <Link href={`/admin/tickets/${apres.id}`} className="civiq-btn civiq-btn-default" style={{ minHeight: 46 }}>Ouvrir le rappel</Link>
      </main>
    );
  }

  return (
    <main className="civiq-main" style={{ maxWidth: 680 }}>
      <Link href="/admin/tickets" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 14 }}>
        <ArrowLeft size={14} /> Interventions
      </Link>
      <h1 className="civiq-page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BellRing size={24} aria-hidden="true" /> Programmer un rappel
      </h1>
      <p style={{ margin: "4px 0 22px", fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.55 }}>
        Le ticket reste en attente jusqu&apos;à la date choisie, puis s&apos;ouvre et vous prévient par notification et par email.
      </p>

      <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <label>
          <span className="civiq-field-label">Objet du rappel</span>
          <input style={champ} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={160} required
            placeholder="Ex : Résilier la location des téléphones" />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label>
            <span className="civiq-field-label">Date d&apos;échéance</span>
            <input type="date" style={champ} value={rappelLe} min={aujourdhui} onChange={(e) => setRappelLe(e.target.value)} required />
          </label>
          <label>
            <span className="civiq-field-label">Me prévenir</span>
            <select style={champ} value={avance} onChange={(e) => setAvance(Number(e.target.value))}>
              {AVANCES.map((a) => <option key={a.jours} value={a.jours}>{a.libelle}</option>)}
            </select>
          </label>
        </div>
        {declenchement && (
          <p style={{ margin: "-8px 0 0", fontSize: 13.5, color: "var(--fg-muted)" }}>
            Le rappel partira le <strong style={{ color: "var(--fg)" }}>{formatJour(declenchement < aujourdhui ? aujourdhui : declenchement)}</strong>
            {declenchement < aujourdhui ? " (dès demain matin : la date d'anticipation est déjà passée)" : ""}.
          </p>
        )}

        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 14, border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={annuel} onChange={(e) => setAnnuel(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1 }} />
          <span>
            <strong style={{ fontSize: 14.5 }}>Répéter chaque année</strong>
            <span style={{ display: "block", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 2 }}>
              À la clôture, le rappel de l&apos;année suivante est créé à la même date, avec les mêmes pièces jointes
              (contrôle des extincteurs, contrat d&apos;assurance…).
            </span>
          </span>
        </label>

        <label>
          <span className="civiq-field-label">Note (facultatif)</span>
          <textarea style={{ ...champ, minHeight: 96, padding: 12, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000}
            placeholder="Ex : préavis de 3 mois, contrat n° 1234, interlocuteur…" />
        </label>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="civiq-field-label">Qui prévenir ?</legend>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Vous{nomService ? <> et les membres du service <strong>{nomService}</strong></> : null} serez prévenus. Seules ces personnes et la direction voient le rappel.
          </p>
          {autres.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 12, padding: "4px 12px" }}>
              {autres.map((p) => (
                <label key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 42, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={choisis.includes(p.id)} style={{ width: 18, height: 18 }}
                    onChange={() => setChoisis((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]))} />
                  {p.full_name ?? "Sans nom"} <span style={{ color: "var(--fg-muted)", fontSize: 12.5 }}>{p.job_title ? FONCTION_LABEL[p.job_title] ?? "" : ""}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div>
          <span className="civiq-field-label">Pièces jointes (facultatif)</span>
          <label className="civiq-btn civiq-btn-outline" style={{ minHeight: 46, cursor: "pointer", display: "inline-flex" }}>
            <Paperclip size={16} /> Ajouter des documents
            <input type="file" multiple accept={ACCEPT_DOCUMENT_RAPPORT} style={{ display: "none" }}
              onChange={(e) => { const l = Array.from(e.target.files ?? []); setFichiers((f) => [...f, ...l].slice(0, 10)); e.target.value = ""; }} />
          </label>
          <span style={{ display: "block", marginTop: 6, fontSize: 12.5, color: "var(--fg-muted)" }}>PDF, Word, Excel, OpenDocument ou texte · 20 Mo par fichier.</span>
          {fichiers.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
              {fichiers.map((f, i) => (
                <li key={`${f.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <Paperclip size={14} aria-hidden="true" /> <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                  <button type="button" className="civiq-btn civiq-btn-ghost" aria-label={`Retirer ${f.name}`} onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} style={{ padding: 6 }}>
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {erreur && <p role="alert" style={{ margin: 0, fontSize: 14, color: "var(--destructive)" }}>{erreur}</p>}
        <button type="submit" className="civiq-btn civiq-btn-default" disabled={!valide || etat === "envoi"} style={{ minHeight: 52, justifyContent: "center", fontSize: 15.5 }}>
          {etat === "envoi" ? <><Loader2 size={16} className="civiq-spin" /> {progression ?? "Envoi…"}</> : "Programmer le rappel"}
        </button>
      </form>
    </main>
  );
}

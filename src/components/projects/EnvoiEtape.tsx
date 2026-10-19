"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mail, Paperclip, Send, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Envoi d'une étape par email (secrétariat, prestataire, agent…).
// Tout est prérempli : destinataires de l'étape, message, pièces
// jointes. Un clic sur « Envoyer » suffit ; tout reste modifiable.
// ═══════════════════════════════════════════════════════════════

interface Suggestion { email: string; label: string; source: string }
interface Prep {
  objet: string;
  message: string;
  suggestions: Suggestion[];
  preselection: string[];
  pieces: Array<{ id: string; nom: string }>;
  historique: Array<{ le: string; destinataires: string[]; par: string | null; envoye: boolean }>;
  expediteur: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  etape: "Partie prenante de l'étape",
  historique: "Déjà destinataire",
  equipe: "Équipe du projet",
  mairie: "Mairie",
};

const dateFr = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export default function EnvoiEtape({
  id, projectId, etapeId, libelle, onClose,
}: { id: string; projectId: string; etapeId: string; libelle: string; onClose: () => void }) {
  const [prep, setPrep] = useState<Prep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [autre, setAutre] = useState("");
  const [objet, setObjet] = useState("");
  const [message, setMessage] = useState("");
  const [pieces, setPieces] = useState<Set<string>>(new Set());
  const [copieMoi, setCopieMoi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState<string[] | null>(null);

  useEffect(() => {
    let annule = false;
    fetch(`/api/projects/${projectId}/milestones/${etapeId}/envoi`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Préparation impossible.");
        return j as Prep;
      })
      .then((p) => {
        if (annule) return;
        setPrep(p);
        setChoisis(p.preselection);
        setObjet(p.objet);
        setMessage(p.message);
        setPieces(new Set(p.pieces.map((x) => x.id)));
      })
      .catch((e) => !annule && setError(e instanceof Error ? e.message : "Préparation impossible."));
    return () => { annule = true; };
  }, [projectId, etapeId]);

  function ajouterAutre() {
    const e = autre.trim().toLowerCase();
    if (!e) return;
    if (!choisis.includes(e)) setChoisis((l) => [...l, e]);
    setAutre("");
  }
  const basculer = (e: string) => setChoisis((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]));

  async function envoyer(ev: FormEvent) {
    ev.preventDefault();
    const destinataires = autre.trim() ? [...choisis, autre.trim().toLowerCase()] : choisis;
    if (destinataires.length === 0) { setError("Choisissez au moins un destinataire."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones/${etapeId}/envoi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinataires, objet, message, documents: [...pieces], copie_moi: copieMoi }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "L'email n'est pas parti.");
      setEnvoye(j.destinataires ?? destinataires);
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'email n'est pas parti.");
    } finally {
      setBusy(false);
    }
  }

  if (envoye) {
    return (
      <div id={id} className="pj-envoi" role="status">
        <p className="pj-envoi-ok">
          <CheckCircle2 size={16} aria-hidden="true" /> Étape envoyée à {envoye.join(", ")}.
          Les réponses arriveront dans votre messagerie.
        </p>
        <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={onClose}>Fermer</button>
      </div>
    );
  }

  return (
    <form id={id} className="pj-envoi" onSubmit={envoyer} aria-label={`Envoyer l'étape « ${libelle} » par email`}>
      <div className="pj-envoi-head">
        <h3 className="pj-envoi-titre"><Mail size={15} aria-hidden="true" /> Envoyer cette étape par email</h3>
        <button type="button" className="civiq-icon-btn" onClick={onClose} aria-label="Fermer"><X size={15} aria-hidden="true" /></button>
      </div>

      {!prep && !error && <p className="pj-envoi-chargement"><Loader2 size={14} className="civiq-spin" aria-hidden="true" /> Préparation du message…</p>}
      {error && <p className="pj-modal-error" role="alert">{error}</p>}

      {prep && (
        <>
          <fieldset className="pj-wiz-fieldset">
            <legend className="civiq-field-label">Destinataires</legend>
            {prep.suggestions.length > 0 && (
              <ul className="pj-envoi-suggestions">
                {prep.suggestions.map((s) => (
                  <li key={s.email}>
                    <label className="pj-wiz-check">
                      <input type="checkbox" checked={choisis.includes(s.email)} onChange={() => basculer(s.email)} />
                      <span>
                        {s.label !== s.email ? <><strong>{s.label}</strong> · {s.email}</> : s.email}
                        <span className="pj-wiz-aide">{SOURCE_LABEL[s.source] ?? ""}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {choisis.filter((c) => !prep.suggestions.some((s) => s.email === c)).length > 0 && (
              <ul className="pj-etape-chips">
                {choisis.filter((c) => !prep.suggestions.some((s) => s.email === c)).map((c) => (
                  <li key={c} className="pj-etape-chip">
                    {c}
                    <button type="button" onClick={() => basculer(c)} aria-label={`Retirer ${c}`}><X size={12} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="pj-wiz-inline">
              <label className="pj-sr-only" htmlFor={`${id}-autre`}>Autre adresse email</label>
              <input id={`${id}-autre`} type="email" className="civiq-input" placeholder="Autre adresse : secretariat@…"
                value={autre} onChange={(e) => setAutre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterAutre(); } }} />
              <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={ajouterAutre}>Ajouter</button>
            </div>
          </fieldset>

          <div className="civiq-field">
            <label htmlFor={`${id}-objet`} className="civiq-field-label">Objet</label>
            <input id={`${id}-objet`} className="civiq-input" value={objet} maxLength={200} required onChange={(e) => setObjet(e.target.value)} />
          </div>
          <div className="civiq-field">
            <label htmlFor={`${id}-msg`} className="civiq-field-label">Message</label>
            <textarea id={`${id}-msg`} className="civiq-textarea pj-envoi-message" rows={12} value={message} required onChange={(e) => setMessage(e.target.value)} />
          </div>

          {prep.pieces.length > 0 && (
            <fieldset className="pj-wiz-fieldset">
              <legend className="civiq-field-label">Pièces jointes</legend>
              {prep.pieces.map((p) => (
                <label key={p.id} className="pj-wiz-check">
                  <input type="checkbox" checked={pieces.has(p.id)}
                    onChange={() => setPieces((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                  <span><Paperclip size={12} aria-hidden="true" /> {p.nom}</span>
                </label>
              ))}
              <p className="civiq-field-hint">Les pièces marquées « note interne » ne sont jamais envoyées.</p>
            </fieldset>
          )}

          {prep.expediteur && (
            <label className="pj-wiz-check">
              <input type="checkbox" checked={copieMoi} onChange={(e) => setCopieMoi(e.target.checked)} />
              M&apos;envoyer une copie ({prep.expediteur}) — les réponses arrivent à cette adresse
            </label>
          )}

          {prep.historique.length > 0 && (
            <ul className="pj-envoi-historique" aria-label="Envois précédents">
              {prep.historique.map((h) => (
                <li key={h.le}>
                  {h.envoye ? "Envoyée" : "Échec de l'envoi"} le {dateFr(h.le)} à {h.destinataires.join(", ")}{h.par ? ` par ${h.par}` : ""}
                </li>
              ))}
            </ul>
          )}

          <div className="pj-etape-details-actions">
            <span className="pj-spacer" />
            <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" onClick={onClose}>Annuler</button>
            <button type="submit" className="civiq-btn civiq-btn-default civiq-btn-sm" disabled={busy || (choisis.length === 0 && !autre.trim())}>
              {busy ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />} Envoyer
            </button>
          </div>
        </>
      )}
    </form>
  );
}

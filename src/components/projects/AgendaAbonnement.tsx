"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CalendarPlus, Check, ChevronDown, Copy, Link2Off, Loader2, RefreshCw, Unplug } from "lucide-react";
import { lienAbonnementGoogle, lienWebcal } from "@/lib/projects/calendar";
import LearnMore from "./LearnMore";

// ═══════════════════════════════════════════════════════════════
// « Retrouver ce calendrier dans mon agenda » (brief §2.11) :
//   1. lien d'abonnement iCal personnel (Google, Apple, Outlook…) ;
//   2. synchronisation Google Agenda, si la plateforme est configurée.
// ═══════════════════════════════════════════════════════════════

type Perimetre = "tout" | "mes";
interface Etat {
  feed: { url: string; perimetre: Perimetre; created_at: string; last_accessed_at: string | null } | null;
  google: {
    configured: boolean;
    connected: boolean;
    email: string | null;
    perimetre: Perimetre;
    last_sync_at: string | null;
    last_sync_ok: boolean | null;
    last_error: string | null;
  };
}

const RETOUR_GOOGLE: Record<string, { ok: boolean; texte: string }> = {
  connecte: { ok: true, texte: "Google Agenda est connecté : l'agenda « GoCiviq » apparaît dans votre compte Google." },
  connecte_erreur: { ok: false, texte: "Google Agenda est connecté, mais la première synchronisation a échoué. Réessayez avec « Synchroniser maintenant »." },
  refuse: { ok: false, texte: "La connexion a été annulée depuis Google. Rien n'a été modifié." },
  expire: { ok: false, texte: "La demande de connexion a expiré. Recommencez." },
  portee: { ok: false, texte: "L'autorisation de gérer l'agenda « GoCiviq » n'a pas été cochée chez Google. Recommencez en l'acceptant." },
  indisponible: { ok: false, texte: "La synchronisation Google Agenda n'est pas configurée sur cette plateforme." },
  erreur: { ok: false, texte: "La connexion à Google Agenda a échoué. Réessayez dans quelques minutes." },
};

const dt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

const PERIMETRES: Array<{ value: Perimetre; label: string; hint?: string }> = [
  { value: "tout", label: "Tout le calendrier de la commune" },
  {
    value: "mes",
    label: "Seulement mes projets et mes commissions",
    hint: "Projets dont vous êtes élu référent, agent ou contributeur, étapes dont vous êtes responsable, commissions dont vous êtes membre.",
  },
];

function ChoixPerimetre({ name, value, onChange, disabled }: { name: string; value: Perimetre; onChange: (p: Perimetre) => void; disabled?: boolean }) {
  return (
    <fieldset className="pj-wiz-fieldset pj-agenda-perimetre">
      <legend className="civiq-field-label">Que voulez-vous voir dans votre agenda ?</legend>
      {PERIMETRES.map((p) => (
        <label key={p.value} className="pj-wiz-check">
          <input type="radio" name={name} value={p.value} checked={value === p.value} onChange={() => onChange(p.value)} disabled={disabled} />
          <span>
            {p.label}
            {p.hint && <span className="civiq-field-hint pj-agenda-hint">{p.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export default function AgendaAbonnement({ retourGoogle }: { retourGoogle?: string | null }) {
  const [open, setOpen] = useState(!!retourGoogle);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [perimetre, setPerimetre] = useState<Perimetre>("tout");
  const panelId = useId();
  const retour = retourGoogle ? RETOUR_GOOGLE[retourGoogle] : null;

  const charger = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/calendar/feed");
    const j = await res.json().catch(() => null);
    if (!res.ok || !j) { setError(j?.error ?? "Impossible de charger vos réglages d'agenda."); return; }
    setEtat(j as Etat);
    if (j.feed) setPerimetre(j.feed.perimetre);
  }, []);

  useEffect(() => { if (open && !etat) void charger(); }, [open, etat, charger]);

  async function appel(key: string, url: string, init: RequestInit, ok?: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? j.erreur ?? "L'opération a échoué."); return false; }
    if (j.feed !== undefined) setEtat(j as Etat); else await charger();
    if (ok) setMessage(ok);
    return true;
  }

  async function copier() {
    if (!etat?.feed) return;
    try {
      await navigator.clipboard.writeText(etat.feed.url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setError("La copie a échoué : sélectionnez le lien et copiez-le à la main.");
    }
  }

  const feed = etat?.feed;
  const g = etat?.google;

  return (
    <section id="agenda" className="civiq-card pj-agenda" aria-labelledby="agenda-titre">
      <h2 id="agenda-titre" className="pj-agenda-heading">
        <button type="button" className="pj-agenda-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          <CalendarPlus size={18} aria-hidden="true" />
          <span>Retrouver ce calendrier dans mon agenda</span>
          <ChevronDown size={16} aria-hidden="true" className={open ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="pj-agenda-body">
        {retour && (
          <p className={`pj-alerte ${retour.ok ? "pj-alerte-recommande" : "pj-alerte-information"}`} role="status">{retour.texte}</p>
        )}
        <p className="pj-params-intro">
          Abonnez votre agenda habituel (téléphone, Google, Outlook) : les dates des projets et des séances de commission
          s&apos;y affichent et se mettent à jour toutes seules. Vous continuez à tout modifier ici.
        </p>
        {error && <p className="pj-modal-error" role="alert">{error}</p>}
        {message && <p className="pj-params-status" role="status">{message}</p>}

        {!etat ? (
          !error && <p className="pj-params-note"><Loader2 size={14} className="civiq-spin" aria-hidden="true" /> Chargement…</p>
        ) : (
          <>
            {/* ─── 1. Abonnement iCal ─── */}
            <div className="pj-agenda-block">
              <h3 className="pj-etape-add-titre">Lien d&apos;abonnement personnel</h3>
              <ChoixPerimetre
                name="agenda-perimetre"
                value={perimetre}
                disabled={!!busy}
                onChange={(p) => {
                  setPerimetre(p);
                  if (feed) void appel("perimetre", "/api/calendar/feed", { method: "PATCH", body: JSON.stringify({ perimetre: p }) }, "Réglage enregistré : votre agenda le prendra en compte à sa prochaine mise à jour.");
                }}
              />

              {!feed ? (
                <button type="button" className="civiq-btn civiq-btn-default" disabled={!!busy}
                  onClick={() => appel("creer", "/api/calendar/feed", { method: "POST", body: JSON.stringify({ perimetre }) })}>
                  {busy === "creer" ? <Loader2 size={16} className="civiq-spin" aria-hidden="true" /> : <CalendarPlus size={16} aria-hidden="true" />} Créer mon lien d&apos;abonnement
                </button>
              ) : (
                <>
                  <div className="pj-agenda-actions">
                    <a className="civiq-btn civiq-btn-default civiq-btn-sm" href={lienAbonnementGoogle(feed.url)} target="_blank" rel="noopener noreferrer">
                      Ajouter à Google Agenda<span className="pj-sr-only"> (nouvel onglet)</span>
                    </a>
                    <a className="civiq-btn civiq-btn-outline civiq-btn-sm" href={lienWebcal(feed.url)}>
                      Ajouter à Apple Calendrier ou Outlook
                    </a>
                  </div>
                  <div className="civiq-field">
                    <label htmlFor="agenda-url" className="civiq-field-label">Lien à copier (pour tout autre agenda)</label>
                    <div className="pj-agenda-copy">
                      <input id="agenda-url" className="civiq-input" readOnly value={feed.url} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" onClick={copier}>
                        {copie ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copie ? "Copié" : "Copier"}
                      </button>
                    </div>
                  </div>
                  <p className="pj-alerte pj-alerte-information">
                    Ce lien est personnel : toute personne qui l&apos;obtient voit les titres et les dates des projets. Si vous
                    l&apos;avez transmis par erreur, changez de lien : l&apos;ancien cessera aussitôt de fonctionner.
                  </p>
                  <p className="pj-params-note">
                    {feed.last_accessed_at ? `Dernière lecture par votre agenda : ${dt(feed.last_accessed_at)}.` : "Votre agenda n'a pas encore lu ce lien."}
                  </p>
                  <div className="pj-agenda-actions">
                    <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" disabled={!!busy}
                      onClick={() => window.confirm("Changer de lien ? L'ancien cessera de fonctionner : il faudra réabonner vos agendas.") &&
                        appel("changer", "/api/calendar/feed", { method: "POST", body: JSON.stringify({ perimetre }) }, "Nouveau lien créé. Réabonnez vos agendas avec ce lien.")}>
                      <RefreshCw size={14} aria-hidden="true" /> Changer de lien
                    </button>
                    <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" disabled={!!busy}
                      onClick={() => window.confirm("Désactiver le lien ? Vos agendas abonnés cesseront d'être mis à jour.") &&
                        appel("desactiver", "/api/calendar/feed", { method: "DELETE" }, "Lien désactivé.")}>
                      <Link2Off size={14} aria-hidden="true" /> Désactiver le lien
                    </button>
                  </div>
                </>
              )}
              <LearnMore label="Comment ça marche ?">
                <p>
                  Ce lien est au format iCal (ou « .ics »), le format standard des agendas. Votre agenda le relit
                  régulièrement : une modification faite ici apparaît en quelques minutes dans Apple Calendrier et
                  jusqu&apos;à 24 heures plus tard dans Google Agenda.
                </p>
                <p>
                  Outlook : « Ajouter un calendrier » → « S&apos;abonner à partir du web », puis collez le lien.
                  Sur iPhone : Réglages → Calendrier → Comptes → Ajouter un compte → Autre → « Ajouter un calendrier avec abonnement ».
                </p>
                <p>L&apos;agenda affiche les dates, les titres, le type de projet, la commission et l&apos;élu référent, jamais les commentaires ni les notes internes.</p>
              </LearnMore>
            </div>

            {/* ─── 2. Google Agenda ─── */}
            {g?.configured && (
              <div className="pj-agenda-block">
                <h3 className="pj-etape-add-titre">Synchronisation Google Agenda</h3>
                <p className="pj-params-intro">
                  Plus rapide que l&apos;abonnement : chaque modification apparaît en quelques minutes dans un agenda séparé
                  « GoCiviq » de votre compte Google. GoCiviq n&apos;a accès qu&apos;à cet agenda, jamais à vos autres agendas.
                </p>
                {!g.connected ? (
                  <>
                    <a className="civiq-btn civiq-btn-default civiq-btn-sm" href="/api/google-calendar/connect">Connecter mon Google Agenda</a>
                    {g.last_error && <p className="pj-params-note">Dernière déconnexion : {g.last_error}</p>}
                  </>
                ) : (
                  <>
                    <p className="pj-params-note">
                      Connecté{g.email ? ` au compte ${g.email}` : ""}.{" "}
                      {g.last_sync_at ? `Dernière synchronisation : ${dt(g.last_sync_at)}${g.last_sync_ok ? "." : " (échec)."}` : ""}
                      {g.last_sync_ok === false && g.last_error ? ` ${g.last_error}` : ""}
                    </p>
                    <ChoixPerimetre name="google-perimetre" value={g.perimetre} disabled={!!busy}
                      onChange={(p) => appel("gperimetre", "/api/google-calendar", { method: "PATCH", body: JSON.stringify({ perimetre: p }) }, "Réglage enregistré et agenda Google mis à jour.")} />
                    <div className="pj-agenda-actions">
                      <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" disabled={!!busy}
                        onClick={() => appel("gsync", "/api/google-calendar/sync", { method: "POST" }, "Agenda Google à jour.")}>
                        {busy === "gsync" ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />} Synchroniser maintenant
                      </button>
                      <button type="button" className="civiq-btn civiq-btn-ghost civiq-btn-sm" disabled={!!busy}
                        onClick={() => window.confirm("Déconnecter Google Agenda ? L'agenda « GoCiviq » restera dans votre compte Google, sans mise à jour : vous pourrez le supprimer depuis Google.") &&
                          appel("gdeco", "/api/google-calendar", { method: "DELETE" }, "Google Agenda déconnecté.")}>
                        <Unplug size={14} aria-hidden="true" /> Déconnecter
                      </button>
                    </div>
                  </>
                )}
                {feed && g.connected && (
                  <p className="pj-alerte pj-alerte-information">
                    Vous utilisez à la fois le lien d&apos;abonnement et la synchronisation : si les deux sont ajoutés à
                    Google Agenda, chaque date y apparaît deux fois. Gardez-en un seul.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

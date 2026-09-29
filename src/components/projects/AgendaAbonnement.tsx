"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Loader2, Plus } from "lucide-react";
import { lienAbonnementGoogle, lienWebcal } from "@/lib/projects/calendar";

// ═══════════════════════════════════════════════════════════════
// « Ajouter à mon agenda » — bouton bleu + menu déroulant par
// destination (maquette Claude Design « Ajout Agenda », variante 1a).
//   1. Afficher : toute la commune / mes projets (un seul réglage pour
//      le lien d'abonnement ET la synchronisation Google) ;
//   2. Ajouter à : Google Agenda (recommandé), Apple, Outlook, autre.
// Le lien d'abonnement personnel est créé au premier choix d'agenda.
// ═══════════════════════════════════════════════════════════════

type Perimetre = "tout" | "mes";
type Vue = "menu" | "google" | "apple" | "outlook" | "autre";
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
  connecte_erreur: { ok: false, texte: "Google Agenda est connecté, mais la première synchronisation a échoué. Réessayez dans un instant." },
  refuse: { ok: false, texte: "La connexion a été annulée depuis Google. Rien n'a été modifié." },
  expire: { ok: false, texte: "La demande de connexion a expiré. Recommencez." },
  portee: { ok: false, texte: "L'autorisation de gérer l'agenda « GoCiviq » n'a pas été cochée chez Google. Recommencez en l'acceptant." },
  indisponible: { ok: false, texte: "La synchronisation Google Agenda n'est pas configurée sur cette plateforme." },
  erreur: { ok: false, texte: "La connexion à Google Agenda a échoué. Réessayez dans quelques minutes." },
};

const AIDE_PERIMETRE: Record<Perimetre, string> = {
  tout: "Tous les projets et toutes les séances de commission de la commune.",
  mes: "Projets dont vous êtes élu référent, agent ou contributeur, étapes dont vous êtes responsable, commissions dont vous êtes membre.",
};
const COURT: Record<Perimetre, string> = { tout: "toute la commune", mes: "mes projets et commissions" };

function ilYa(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

/** Abonnement Outlook web (Microsoft 365, le plus courant en mairie). */
const lienOutlook = (url: string) =>
  `https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent("GoCiviq")}`;

const DESTINATIONS: Array<{ vue: Exclude<Vue, "menu">; titre: string; detail: string; logo: string; cls: string }> = [
  { vue: "google", titre: "Google Agenda", detail: "Mis à jour en quelques minutes", logo: "G", cls: "is-google" },
  { vue: "apple", titre: "Apple Calendrier", detail: "iPhone, iPad, Mac", logo: "A", cls: "is-apple" },
  { vue: "outlook", titre: "Outlook", detail: "Outlook.com, Microsoft 365", logo: "O", cls: "is-outlook" },
  { vue: "autre", titre: "Autre application", detail: "Copier le lien d'abonnement", logo: "+", cls: "is-other" },
];

export default function AgendaAbonnement({ retourGoogle }: { retourGoogle?: string | null }) {
  const [open, setOpen] = useState(!!retourGoogle);
  const [vue, setVue] = useState<Vue>("menu");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [perimetre, setPerimetre] = useState<Perimetre>("tout");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(retourGoogle ? RETOUR_GOOGLE[retourGoogle]?.texte ?? null : null);
  const [copie, setCopie] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/calendar/feed");
    const j = (await res.json().catch(() => null)) as (Etat & { error?: string }) | null;
    if (!res.ok || !j) { setError(j?.error ?? "Impossible de charger vos réglages d'agenda."); return null; }
    setEtat(j);
    setPerimetre(j.google.connected ? j.google.perimetre : j.feed?.perimetre ?? "tout");
    return j;
  }, []);

  useEffect(() => { void charger(); }, [charger]);
  useEffect(() => {
    if (etat?.google.connected && retourGoogle) setVue("google");
  }, [etat, retourGoogle]);

  // Fermeture : clic extérieur ou Échap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function appel(key: string, url: string, init: RequestInit, ok?: string): Promise<boolean> {
    setBusy(key);
    setError(null);
    setMessage(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? j.erreur ?? "L'opération a échoué."); return false; }
    if (ok) setMessage(ok);
    return true;
  }

  async function choisirPerimetre(p: Perimetre) {
    if (p === perimetre || busy) return;
    setPerimetre(p);
    if (!etat) return;
    if (etat.feed) await appel("perimetre", "/api/calendar/feed", { method: "PATCH", body: JSON.stringify({ perimetre: p }) });
    if (etat.google.connected) await appel("perimetre", "/api/google-calendar", { method: "PATCH", body: JSON.stringify({ perimetre: p }) });
    if (etat.feed || etat.google.connected) await charger();
  }

  /** Ouvre la vue d'une destination ; crée le lien d'abonnement au besoin. */
  async function choisir(v: Exclude<Vue, "menu">) {
    if (!etat) return;
    if (v === "google" && etat.google.configured && !etat.google.connected) {
      window.location.href = "/api/google-calendar/connect";
      return;
    }
    if (v !== "google" || !etat.google.configured) {
      if (!etat.feed && !(await appel("creer", "/api/calendar/feed", { method: "POST", body: JSON.stringify({ perimetre }) }))) return;
      await charger();
    }
    setVue(v);
  }

  async function copier() {
    if (!etat?.feed) return;
    try {
      await navigator.clipboard.writeText(etat.feed.url);
      setCopie(true);
      setTimeout(() => setCopie(false), 1600);
    } catch {
      setError("La copie a échoué : sélectionnez le lien et copiez-le à la main.");
    }
  }

  const g = etat?.google;
  const feed = etat?.feed ?? null;
  const connecte = !!g?.connected;
  const titreVue = DESTINATIONS.find((d) => d.vue === vue)?.titre ?? "";
  const ouvrir =
    !feed ? null
      : vue === "apple" ? { href: lienWebcal(feed.url), label: "Ouvrir dans Apple Calendrier", externe: false }
      : vue === "outlook" ? { href: lienOutlook(feed.url), label: "Ouvrir dans Outlook", externe: true }
      : vue === "google" ? { href: lienAbonnementGoogle(feed.url), label: "Ouvrir dans Google Agenda", externe: true }
      : null;

  return (
    <div className="pj-agenda-menu" ref={ref}>
      <button
        type="button"
        className={`civiq-btn ${connecte ? "civiq-btn-outline" : "civiq-btn-default"} pj-agenda-cta`}
        aria-expanded={open}
        aria-controls="pj-agenda-panel"
        onClick={() => { setOpen((o) => !o); setVue(connecte ? "google" : "menu"); }}
      >
        {connecte && <span className="pj-agenda-dot" aria-hidden="true" />}
        {connecte ? "Dans Google Agenda" : "Ajouter à mon agenda"}
        <ChevronDown size={14} aria-hidden="true" className={open ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
      </button>

      {open && (
        <div id="pj-agenda-panel" className="pj-agenda-panel" role="region" aria-label="Ajouter le calendrier à mon agenda">
          {message && <p className="pj-agenda-msg" role="status">{message}</p>}
          {error && <p className="pj-modal-error pj-agenda-msg" role="alert">{error}</p>}
          {!etat ? (
            !error && <p className="pj-agenda-pad pj-params-note"><Loader2 size={14} className="civiq-spin" aria-hidden="true" /> Chargement…</p>
          ) : vue === "menu" ? (
            <>
              <div className="pj-agenda-pad">
                <p className="pj-agenda-label" id="agenda-afficher">Afficher</p>
                <div className="pj-agenda-seg" role="radiogroup" aria-labelledby="agenda-afficher">
                  {(["tout", "mes"] as const).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={perimetre === p}
                      className={perimetre === p ? "is-on" : ""} disabled={busy === "perimetre"} onClick={() => void choisirPerimetre(p)}>
                      {p === "tout" ? "Toute la commune" : "Mes projets"}
                    </button>
                  ))}
                </div>
                <p className="pj-agenda-help">{AIDE_PERIMETRE[perimetre]}</p>
              </div>
              <div className="pj-agenda-sep" />
              <div className="pj-agenda-list">
                <p className="pj-agenda-label pj-agenda-label-list">Ajouter à</p>
                {DESTINATIONS.map((d) => (
                  <button key={d.vue} type="button" className="pj-agenda-dest-item" disabled={!!busy} onClick={() => void choisir(d.vue)}>
                    <span className={`pj-agenda-logo ${d.cls}`} aria-hidden="true">{d.logo === "+" ? <Plus size={16} /> : d.logo}</span>
                    <span className="pj-agenda-dest-text">
                      <span className="pj-agenda-dest-title">
                        {d.titre}
                        {d.vue === "google" && <span className="pj-agenda-reco">Recommandé</span>}
                      </span>
                      <span className="pj-agenda-dest-detail">
                        {d.vue === "google" && !g?.configured ? "Mis à jour sous quelques heures" : d.detail}
                      </span>
                    </span>
                    {busy === "creer" ? <Loader2 size={14} className="civiq-spin" aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" className="pj-agenda-chevron" />}
                  </button>
                ))}
              </div>
              <p className="pj-agenda-foot">Lecture seule : les modifications se font toujours dans GoCiviq.</p>
            </>
          ) : vue === "google" && connecte ? (
            <div className="pj-agenda-pad pj-agenda-stack">
              <div className="pj-agenda-ok">
                <span className="pj-agenda-ok-icon" aria-hidden="true"><Check size={18} /></span>
                <div>
                  <p className="pj-agenda-ok-title">Connecté à Google Agenda</p>
                  {g?.email && <p className="pj-agenda-help">{g.email}</p>}
                </div>
              </div>
              <dl className="pj-agenda-facts">
                <div><dt>Agenda</dt><dd>« GoCiviq »</dd></div>
                <div><dt>Contenu</dt><dd>{COURT[g!.perimetre]}</dd></div>
                <div><dt>Dernière synchro</dt><dd className={g?.last_sync_ok === false ? "pj-text-danger" : undefined}>
                  {g?.last_sync_at ? `${ilYa(g.last_sync_at)}${g.last_sync_ok === false ? " (échec)" : ""}` : "—"}
                </dd></div>
              </dl>
              {g?.last_sync_ok === false && g.last_error && <p className="pj-agenda-help pj-text-danger">{g.last_error}</p>}
              <p className="pj-agenda-help">GoCiviq n&apos;a accès qu&apos;à cet agenda, jamais à vos autres agendas.</p>
              <div className="pj-agenda-row">
                <a className="civiq-btn civiq-btn-default civiq-btn-sm pj-agenda-grow" href="https://calendar.google.com/calendar/r" target="_blank" rel="noopener noreferrer">
                  Ouvrir Google Agenda<span className="pj-sr-only"> (nouvel onglet)</span>
                </a>
                {g?.last_sync_ok === false ? (
                  <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm" disabled={!!busy}
                    onClick={async () => { if (await appel("gsync", "/api/google-calendar/sync", { method: "POST" }, "Agenda Google à jour.")) await charger(); }}>
                    Réessayer
                  </button>
                ) : null}
                <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm pj-agenda-danger" disabled={!!busy}
                  onClick={async () => {
                    if (!window.confirm("Déconnecter Google Agenda ? L'agenda « GoCiviq » restera dans votre compte Google, sans mise à jour : vous pourrez le supprimer depuis Google.")) return;
                    if (await appel("gdeco", "/api/google-calendar", { method: "DELETE" }, "Google Agenda déconnecté.")) { await charger(); setVue("menu"); }
                  }}>
                  Déconnecter
                </button>
              </div>
              <button type="button" className="pj-link-btn" onClick={() => setVue("menu")}>Changer ce qui est affiché</button>
            </div>
          ) : (
            <>
              <div className="pj-agenda-back">
                <button type="button" className="pj-agenda-back-btn" onClick={() => setVue("menu")} aria-label="Retour au choix de l'agenda">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <p className="pj-agenda-back-title">{titreVue}</p>
              </div>
              {feed && (
                <div className="pj-agenda-pad pj-agenda-stack">
                  {ouvrir && (
                    <>
                      <a className="civiq-btn civiq-btn-default" href={ouvrir.href} {...(ouvrir.externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                        {ouvrir.label}{ouvrir.externe && <span className="pj-sr-only"> (nouvel onglet)</span>}
                      </a>
                      <p className="pj-agenda-or"><span aria-hidden="true" />ou copiez le lien<span aria-hidden="true" /></p>
                    </>
                  )}
                  <div className="pj-agenda-copy">
                    <label htmlFor="agenda-url" className="pj-sr-only">Lien d&apos;abonnement personnel</label>
                    <input id="agenda-url" className="pj-agenda-url" readOnly value={feed.url} onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" className={`pj-agenda-copy-btn ${copie ? "is-done" : ""}`} onClick={copier}>
                      {copie ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copie ? "Copié" : "Copier"}
                    </button>
                  </div>
                  {vue === "autre" && (
                    <ol className="pj-agenda-steps">
                      <li>Copiez le lien ci-dessus</li>
                      <li>Dans votre agenda : « S&apos;abonner à un calendrier » ou « Ajouter par URL »</li>
                      <li>Collez le lien et validez</li>
                    </ol>
                  )}
                  <p className="pj-agenda-help">
                    Contenu : {COURT[feed.perimetre]}. Mise à jour toutes les quelques heures selon l&apos;application.
                    Lien personnel, ne le partagez pas.
                  </p>
                  <div className="pj-agenda-row pj-agenda-discret">
                    <button type="button" className="pj-link-btn" disabled={!!busy}
                      onClick={async () => {
                        if (!window.confirm("Changer de lien ? L'ancien cessera aussitôt de fonctionner : il faudra réabonner vos agendas.")) return;
                        if (await appel("changer", "/api/calendar/feed", { method: "POST", body: JSON.stringify({ perimetre }) }, "Nouveau lien créé. Réabonnez vos agendas avec ce lien.")) await charger();
                      }}>
                      Changer de lien
                    </button>
                    <button type="button" className="pj-link-btn" disabled={!!busy}
                      onClick={async () => {
                        if (!window.confirm("Désactiver le lien ? Vos agendas abonnés cesseront d'être mis à jour.")) return;
                        if (await appel("desactiver", "/api/calendar/feed", { method: "DELETE" }, "Lien désactivé.")) { await charger(); setVue("menu"); }
                      }}>
                      Désactiver
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

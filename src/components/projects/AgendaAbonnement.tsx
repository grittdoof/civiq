"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Check, ChevronDown, Copy, Loader2, Plus } from "lucide-react";
import { lienWebcal } from "@/lib/projects/calendar";

// ═══════════════════════════════════════════════════════════════
// « Retrouver ce calendrier dans mon agenda » — panneau en 2 étapes
// (maquette « Ajout Agenda », variante 1b) :
//   ① Quels événements ?  (toute la commune / ce qui me concerne)
//   ② Dans quel agenda ?  (Google Agenda recommandé | autre agenda)
// Un seul choix de périmètre, appliqué au lien d'abonnement ET à la
// synchronisation Google.
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
  connecte_erreur: { ok: false, texte: "Google Agenda est connecté, mais la première synchronisation a échoué. Réessayez dans un instant." },
  refuse: { ok: false, texte: "La connexion a été annulée depuis Google. Rien n'a été modifié." },
  expire: { ok: false, texte: "La demande de connexion a expiré. Recommencez." },
  portee: { ok: false, texte: "L'autorisation de gérer l'agenda « GoCiviq » n'a pas été cochée chez Google. Recommencez en l'acceptant." },
  indisponible: { ok: false, texte: "La synchronisation Google Agenda n'est pas configurée sur cette plateforme." },
  erreur: { ok: false, texte: "La connexion à Google Agenda a échoué. Réessayez dans quelques minutes." },
};

const PERIMETRES: Array<{ value: Perimetre; titre: string; detail: string; court: string }> = [
  { value: "tout", titre: "Tout le calendrier de la commune", detail: "Tous les projets et toutes les commissions", court: "toute la commune" },
  {
    value: "mes",
    titre: "Seulement ce qui me concerne",
    detail: "Mes projets, mes étapes, mes commissions",
    court: "mes projets et commissions",
  },
];
const court = (p: Perimetre) => PERIMETRES.find((x) => x.value === p)!.court;

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

export default function AgendaAbonnement({ retourGoogle }: { retourGoogle?: string | null }) {
  const [open, setOpen] = useState(!!retourGoogle);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [perimetre, setPerimetre] = useState<Perimetre>("tout");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const panelId = useId();
  const retour = retourGoogle ? RETOUR_GOOGLE[retourGoogle] : null;

  const charger = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/calendar/feed");
    const j = (await res.json().catch(() => null)) as (Etat & { error?: string }) | null;
    if (!res.ok || !j) { setError(j?.error ?? "Impossible de charger vos réglages d'agenda."); return; }
    setEtat(j);
    setPerimetre(j.google.connected ? j.google.perimetre : j.feed?.perimetre ?? "tout");
  }, []);

  // Chargé d'emblée : la pastille d'état de l'en-tête en dépend.
  useEffect(() => { void charger(); }, [charger]);

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
    let ok = true;
    if (etat.feed) ok = (await appel("perimetre", "/api/calendar/feed", { method: "PATCH", body: JSON.stringify({ perimetre: p }) })) && ok;
    if (etat.google.connected) ok = (await appel("perimetre", "/api/google-calendar", { method: "PATCH", body: JSON.stringify({ perimetre: p }) })) && ok;
    if (etat.feed || etat.google.connected) {
      if (ok) setMessage("Réglage enregistré : vos agendas afficheront " + court(p) + ".");
      await charger();
    }
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

  const feed = etat?.feed ?? null;
  const g = etat?.google;
  const puce = g?.connected
    ? { cls: "is-google", label: "Google Agenda connecté" }
    : feed
      ? { cls: "is-link", label: "Lien créé" }
      : { cls: "", label: "Non configuré" };

  return (
    <section id="agenda" className="pj-agenda" aria-labelledby="agenda-titre">
      <h2 id="agenda-titre" className="pj-agenda-heading">
        <button type="button" className="pj-agenda-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          <span className="pj-agenda-toggle-text">
            <span className="pj-agenda-toggle-title">Retrouver ce calendrier dans mon agenda</span>
            <span className="pj-agenda-toggle-sub">Google, iPhone, Outlook… mis à jour automatiquement</span>
          </span>
          {etat && (
            <span className={`pj-agenda-puce ${puce.cls}`}>
              {g?.connected && <span className="pj-agenda-dot" aria-hidden="true" />}
              {puce.label}
            </span>
          )}
          <ChevronDown size={16} aria-hidden="true" className={open ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="pj-agenda-body">
        {retour && <p className={`pj-alerte ${retour.ok ? "pj-alerte-recommande" : "pj-alerte-information"}`} role="status">{retour.texte}</p>}
        {error && <p className="pj-modal-error" role="alert">{error}</p>}
        {message && <p className="pj-params-status" role="status">{message}</p>}

        {!etat ? (
          !error && <p className="pj-params-note"><Loader2 size={14} className="civiq-spin" aria-hidden="true" /> Chargement…</p>
        ) : (
          <>
            {/* ─── ① Quels événements ? ─── */}
            <fieldset className="pj-agenda-step">
              <legend className="pj-agenda-step-title"><span className="pj-agenda-step-num" aria-hidden="true">1</span>Quels événements ?</legend>
              <div className="pj-agenda-scopes">
                {PERIMETRES.map((p) => (
                  <label key={p.value} className={`pj-agenda-scope ${perimetre === p.value ? "is-selected" : ""}`}>
                    <input type="radio" name="agenda-perimetre" value={p.value} checked={perimetre === p.value}
                      onChange={() => void choisirPerimetre(p.value)} disabled={busy === "perimetre"} />
                    <span className="pj-agenda-scope-text">
                      <span className="pj-agenda-scope-titre">{p.titre}</span>
                      <span className="pj-agenda-scope-detail">{p.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* ─── ② Dans quel agenda ? ─── */}
            <div className="pj-agenda-step" role="group" aria-labelledby="agenda-step2">
              <p id="agenda-step2" className="pj-agenda-step-title"><span className="pj-agenda-step-num" aria-hidden="true">2</span>Dans quel agenda ?</p>
              <div className={`pj-agenda-dest ${g?.configured ? "" : "is-single"}`}>
                {g?.configured && (
                  <div className="pj-agenda-card">
                    <div className="pj-agenda-card-head">
                      <span className="pj-agenda-logo is-google" aria-hidden="true">G</span>
                      <h3 className="pj-agenda-card-title">Google Agenda</h3>
                      <span className="pj-agenda-reco">Recommandé</span>
                    </div>
                    {!g.connected ? (
                      <>
                        <p className="pj-agenda-card-text">
                          Un agenda « GoCiviq » est créé dans votre compte, mis à jour en quelques minutes. Aucun accès à vos autres agendas.
                        </p>
                        <a className="civiq-btn civiq-btn-default civiq-btn-sm pj-agenda-cta" href="/api/google-calendar/connect">Connecter Google Agenda</a>
                        {g.last_error && <p className="pj-agenda-card-note">Dernière déconnexion : {g.last_error}</p>}
                      </>
                    ) : (
                      <>
                        {g.last_sync_ok === false ? (
                          <p className="pj-agenda-sync is-error">
                            Échec de la synchronisation{g.last_error ? ` : ${g.last_error}` : "."}
                          </p>
                        ) : (
                          <p className="pj-agenda-sync"><span className="pj-agenda-dot" aria-hidden="true" />Synchronisé{g.last_sync_at ? ` · ${ilYa(g.last_sync_at)}` : ""}</p>
                        )}
                        <p className="pj-agenda-card-text">{[g.email, court(g.perimetre)].filter(Boolean).join(" · ")}</p>
                        <div className="pj-agenda-links">
                          <a href="https://calendar.google.com/calendar/r" target="_blank" rel="noopener noreferrer">
                            Ouvrir Google Agenda<span className="pj-sr-only"> (nouvel onglet)</span>
                          </a>
                          {g.last_sync_ok === false && (
                            <button type="button" className="pj-link-btn" disabled={!!busy}
                              onClick={async () => { if (await appel("gsync", "/api/google-calendar/sync", { method: "POST" }, "Agenda Google à jour.")) await charger(); }}>
                              {busy === "gsync" ? "Synchronisation…" : "Réessayer"}
                            </button>
                          )}
                          <button type="button" className="pj-link-btn pj-agenda-danger" disabled={!!busy}
                            onClick={async () => {
                              if (!window.confirm("Déconnecter Google Agenda ? L'agenda « GoCiviq » restera dans votre compte Google, sans mise à jour : vous pourrez le supprimer depuis Google.")) return;
                              if (await appel("gdeco", "/api/google-calendar", { method: "DELETE" }, "Google Agenda déconnecté.")) await charger();
                            }}>
                            Déconnecter
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="pj-agenda-card">
                  <div className="pj-agenda-card-head">
                    <span className="pj-agenda-logo is-other" aria-hidden="true"><Plus size={16} /></span>
                    <h3 className="pj-agenda-card-title">{g?.configured ? "Autre agenda" : "Mon agenda"}</h3>
                  </div>
                  {!feed ? (
                    <>
                      <p className="pj-agenda-card-text">
                        {g?.configured ? "iPhone, Outlook, Thunderbird…" : "Google, iPhone, Outlook, Thunderbird…"} via un lien d&apos;abonnement.
                        Mise à jour toutes les quelques heures.
                      </p>
                      <button type="button" className="civiq-btn civiq-btn-outline civiq-btn-sm pj-agenda-cta" disabled={!!busy}
                        onClick={async () => { if (await appel("creer", "/api/calendar/feed", { method: "POST", body: JSON.stringify({ perimetre }) })) await charger(); }}>
                        {busy === "creer" && <Loader2 size={14} className="civiq-spin" aria-hidden="true" />} Obtenir mon lien
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="pj-agenda-copy">
                        <label htmlFor="agenda-url" className="pj-sr-only">Lien d&apos;abonnement personnel</label>
                        <input id="agenda-url" className="pj-agenda-url" readOnly value={feed.url} onFocus={(e) => e.currentTarget.select()} />
                        <button type="button" className={`pj-agenda-copy-btn ${copie ? "is-done" : ""}`} onClick={copier}>
                          {copie ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copie ? "Copié" : "Copier"}
                        </button>
                      </div>
                      <p className="pj-agenda-card-note">Collez-le dans « S&apos;abonner à un calendrier ». Lien personnel, ne le partagez pas.</p>
                      <div className="pj-agenda-links">
                        <a href={lienWebcal(feed.url)}>Ouvrir sur iPhone / Mac</a>
                        <a href={lienOutlook(feed.url)} target="_blank" rel="noopener noreferrer">
                          Ouvrir dans Outlook<span className="pj-sr-only"> (nouvel onglet)</span>
                        </a>
                      </div>
                      <div className="pj-agenda-links pj-agenda-links-discret">
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
                            if (await appel("desactiver", "/api/calendar/feed", { method: "DELETE" }, "Lien désactivé.")) await charger();
                          }}>
                          Désactiver
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {feed && g?.connected && (
                <p className="pj-agenda-card-note">
                  Si vous avez aussi ajouté le lien d&apos;abonnement dans Google Agenda, chaque date y apparaît deux fois : gardez-en un seul.
                </p>
              )}
            </div>

            <p className="pj-agenda-footer">
              Les événements apparaissent en lecture seule, sans commentaires ni notes internes. Vous continuez à tout modifier ici.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

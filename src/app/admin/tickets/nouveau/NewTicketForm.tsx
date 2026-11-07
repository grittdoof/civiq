"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  PencilLine,
  Save,
  Siren,
  X,
} from "lucide-react";
import TicketLocationPicker from "@/components/tickets/TicketLocationPicker";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { createTicket } from "@/lib/tickets/mutations";
import VisibiliteChamps, { type Personne } from "@/components/tickets/VisibiliteChamps";
import IconeCategorie from "@/components/tickets/IconeCategorie";
import {
  URGENCES, URGENCE_AIDE, URGENCE_COLORS, URGENCE_LABELS, arborescence, cheminCategorie, reglagesEffectifs,
  type CategorieTicket,
} from "@/lib/tickets/categories";
import {
  CANAL_LABELS,
  CATEGORIE_LABELS,
  CATEGORIE_ICONS,
  PRIORITE_LABELS,
  PRIORITE_COLORS,
  type TicketCanal,
  type TicketCategorie,
  type TicketPriorite,
} from "@/lib/tickets/types";
import {
  useTicketWizard,
  type WizardStepId,
  type WizardValue,
} from "@/lib/tickets/useTicketWizard";

// ═══════════════════════════════════════════════════════════════
// NewTicketForm — orchestrateur.
//
// Détection runtime du viewport : on monte UN SEUL des deux rendus
// (jamais les deux). Ils partagent l'état via useTicketWizard.
//
//   • Mobile (< 900px)  : MobileWizard — une question par écran, CTA
//     sticky bas, récap éditable en bottom sheet.
//   • Desktop (≥ 900px) : DesktopForm — page admin classique, toutes
//     les sections empilées en pleine largeur, submit en bas.
// ═══════════════════════════════════════════════════════════════

// Lot 1 : services de la commune et personnes nommables, partagés
// avec l'étape « Service et visibilité » sans traverser les écrans.
interface OptionsVisibilite {
  services: Array<{ id: string; nom: string }>;
  personnes: Personne[];
  moi: string;
  /** Lot 2 : taxonomie de la commune (actives seulement). */
  categories: CategorieTicket[];
}
const VisibiliteCtx = createContext<OptionsVisibilite>({ services: [], personnes: [], moi: "", categories: [] });

interface Props {
  communeId: string;
  services?: OptionsVisibilite["services"];
  personnes?: Personne[];
  moi?: string;
  categories?: CategorieTicket[];
  agents: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
}

const CANAUX: Array<{ value: TicketCanal; emoji: string; help: string }> = [
  { value: "elu_terrain", emoji: "🏃", help: "Je signale depuis le terrain (mobile)" },
  { value: "agent_interne", emoji: "🏛️", help: "Je crée pour un service municipal" },
  { value: "telephone", emoji: "📞", help: "Suite à un appel d'un habitant" },
  { value: "email", emoji: "✉️", help: "Suite à un email reçu" },
];

const CATEGORIES: TicketCategorie[] = [
  "voirie", "espaces_verts", "batiment", "eclairage_public",
  "proprete", "mobilier_urbain", "reseaux_eau", "signalisation", "autre",
];

const PRIORITES: Array<{ value: TicketPriorite; sub: string }> = [
  { value: "basse", sub: "À traiter quand possible" },
  { value: "normale", sub: "Délai normal d'intervention" },
  { value: "haute", sub: "Demande de l'attention rapide" },
  { value: "urgente", sub: "Risque immédiat ou bloquant" },
];

type Agent = { id: string; full_name: string | null; job_title: string | null };

// ─── Détection viewport ──────────────────────────────────────────

function useIsDesktop(breakpoint = 900): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isDesktop;
}

// ─── Orchestrateur ───────────────────────────────────────────────

export default function NewTicketForm({ communeId, agents, services = [], personnes = [], moi = "", categories = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const wiz = useTicketWizard();
  const { value, set, isDirty } = wiz;

  // Block native back if dirty
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  function toggleAssignee(id: string) {
    set(
      "assigneIds",
      value.assigneIds.includes(id)
        ? value.assigneIds.filter((x) => x !== id)
        : [...value.assigneIds, id],
    );
  }

  function submit() {
    setError(null);
    if (!wiz.isValidGlobal || !value.categorieId) {
      setError("Certaines informations sont incomplètes.");
      return;
    }
    const showDemandeur = value.canal === "telephone" || value.canal === "email";
    startTransition(async () => {
      try {
        const result = await createTicket({
          canal: value.canal,
          demandeur_nom: showDemandeur ? value.demandeur_nom : null,
          demandeur_telephone: showDemandeur ? value.demandeur_telephone : null,
          demandeur_email: showDemandeur ? value.demandeur_email : null,
          demandeur_adresse: showDemandeur ? value.demandeur_adresse : null,
          titre: value.titre,
          description: value.description,
          categorie_id: value.categorieId!,
          urgence: value.urgence,
          adresse: value.location.adresse,
          latitude: value.location.latitude,
          longitude: value.location.longitude,
          precision_geo: value.location.precision_geo,
          assignee_ids: value.assigneIds,
          echeance: value.echeance || null,
          photo_paths: value.photoPaths,
          service_id: value.serviceId || null,
          confidentialite: value.confidentialite,
          destinataire_ids: value.confidentialite === "standard" ? [] : value.destinataireIds,
        });
        router.push(`/admin/tickets/${result.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    });
  }

  // Avant détection : rendu mobile par défaut (le plus fréquent ici,
  // et l'admin shell mobile cache la complexité d'un éventuel flash).
  if (isDesktop === null || !isDesktop) {
    return (
      <VisibiliteCtx.Provider value={{ services, personnes, moi, categories }}>
      <MobileWizard
        wiz={wiz}
        agents={agents}
        communeId={communeId}
        toggleAssignee={toggleAssignee}
        error={error}
        setError={setError}
        pending={pending}
        submit={submit}
      />
      </VisibiliteCtx.Provider>
    );
  }

  return (
    <VisibiliteCtx.Provider value={{ services, personnes, moi, categories }}>
    <DesktopForm
      wiz={wiz}
      agents={agents}
      communeId={communeId}
      toggleAssignee={toggleAssignee}
      error={error}
      pending={pending}
      submit={submit}
    />
    </VisibiliteCtx.Provider>
  );
}

// ─── MOBILE WIZARD ──────────────────────────────────────────────

function MobileWizard({
  wiz, agents, communeId, toggleAssignee, error, setError, pending, submit,
}: {
  wiz: ReturnType<typeof useTicketWizard>;
  agents: Agent[];
  communeId: string;
  toggleAssignee: (id: string) => void;
  error: string | null;
  setError: (e: string | null) => void;
  pending: boolean;
  submit: () => void;
}) {
  const router = useRouter();
  const [showRecap, setShowRecap] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const { value, set, steps, current, currentStep, total, canNext, invalidReason, isDirty } = wiz;

  function attemptQuit() {
    if (isDirty) setConfirmQuit(true);
    else router.push("/admin/tickets");
  }
  function handlePrev() {
    setError(null);
    if (current === 0) {
      attemptQuit();
      return;
    }
    wiz.prev();
  }
  function handleNext() {
    setError(null);
    if (!canNext) return;
    if (wiz.isOnLastStep) {
      setShowRecap(true);
      return;
    }
    wiz.next();
  }

  return (
    <main className="tk-wizard">
      <header className="tk-wizard-header">
        {/* Placeholder gauche pour préserver le centrage du label étape.
            La zone gauche est déjà occupée par le hamburger AdminShell. */}
        <span className="tk-wizard-iconbtn" aria-hidden style={{ visibility: "hidden" }}>
          <X size={18} />
        </span>
        <span className="tk-wizard-step">
          Étape {current + 1} sur {total}
        </span>
        <button
          type="button"
          onClick={attemptQuit}
          className="tk-wizard-iconbtn"
          aria-label="Quitter"
        >
          <X size={18} />
        </button>
      </header>

      <div className="tk-wizard-progress">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`tk-wizard-progress-seg${i <= current ? " filled" : ""}`}
          />
        ))}
      </div>

      <div className="tk-wizard-body">
        {error && (
          <div className="tk-wizard-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="tk-wizard-title-block">
          <div className="tk-wizard-eyebrow">{currentStep.eyebrow}</div>
          <h1 className="tk-wizard-title">{currentStep.title}</h1>
          {currentStep.subtitle && (
            <p className="tk-wizard-subtitle">{currentStep.subtitle}</p>
          )}
        </div>

        <StepContent
          stepId={currentStep.id}
          value={value}
          set={set}
          agents={agents}
          communeId={communeId}
          toggleAssignee={toggleAssignee}
          variant="mobile"
        />

        {invalidReason && (
          <p className="tk-wizard-hint">{invalidReason}</p>
        )}
      </div>

      <div className="tk-wizard-cta">
        <button
          type="button"
          onClick={handlePrev}
          className="civiq-btn civiq-btn-outline tk-wizard-cta-prev"
        >
          <ArrowLeft size={16} />
          {current === 0 ? "Annuler" : "Précédent"}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext || pending}
          className="civiq-btn civiq-btn-default tk-wizard-cta-next"
        >
          {wiz.isOnLastStep ? "Vérifier" : "Continuer"}
        </button>
      </div>

      {showRecap && (
        <RecapSheet
          value={value}
          steps={steps.map((s) => s.id)}
          agents={agents}
          pending={pending}
          onEdit={(id) => {
            setShowRecap(false);
            wiz.goToStep(id);
          }}
          onClose={() => setShowRecap(false)}
          onSubmit={submit}
        />
      )}

      {confirmQuit && (
        <ConfirmQuitDialog
          onCancel={() => setConfirmQuit(false)}
          onConfirm={() => router.push("/admin/tickets")}
        />
      )}
    </main>
  );
}

// ─── DESKTOP FORM ───────────────────────────────────────────────

function DesktopForm({
  wiz, agents, communeId, toggleAssignee, error, pending, submit,
}: {
  wiz: ReturnType<typeof useTicketWizard>;
  agents: Agent[];
  communeId: string;
  toggleAssignee: (id: string) => void;
  error: string | null;
  pending: boolean;
  submit: () => void;
}) {
  const { value, set, steps, isValidGlobal, missingSteps } = wiz;
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const invalidIds = new Set(missingSteps.map((m) => m.id));

  // Affiche les erreurs en rouge dès qu'on a tenté de soumettre une fois.
  // Une fois la section corrigée, son highlight retombe (recalcul auto).
  const showErrors = submitAttempted && !isValidGlobal;

  function handleSubmit() {
    if (pending) return;
    if (!isValidGlobal) {
      setSubmitAttempted(true);
      // Scroll vers la 1ère section manquante (un peu plus tard pour
      // laisser le temps au DOM d'appliquer la classe).
      setTimeout(() => {
        const first = missingSteps[0]?.id;
        if (first) {
          const el = document.querySelector(`[data-step-id="${first}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
      return;
    }
    submit();
  }

  return (
    <main className="civiq-main tk-form-desktop">
      <Link href="/admin/tickets" className="tk-form-desktop-back">
        <ArrowLeft size={14} /> Tickets
      </Link>

      <header className="tk-form-desktop-header">
        <h1 className="civiq-page-title">Nouveau ticket</h1>
        <p className="tk-form-desktop-sub">
          Renseigne toutes les sections puis valide en bas de page. Les sections
          marquées « optionnel » peuvent rester vides.
        </p>
      </header>

      {error && (
        <div className="tk-wizard-error tk-form-desktop-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="tk-form-desktop-sections">
        {steps.map((step, i) => {
          const hasError = showErrors && invalidIds.has(step.id);
          const errorReason = hasError
            ? missingSteps.find((m) => m.id === step.id)?.reason
            : null;
          return (
          <section
            key={step.id}
            className="civiq-card tk-form-desktop-card"
            data-step-id={step.id}
            data-error={hasError ? "true" : "false"}
          >
            <div className="tk-form-desktop-card-head">
              <span className="tk-form-desktop-num">{i + 1}</span>
              <div>
                <div className="tk-form-desktop-eyebrow">
                  {step.eyebrow}
                  {step.optional && <span className="tk-form-desktop-optional"> · optionnel</span>}
                  {hasError && <span className="tk-form-desktop-required"> · requis</span>}
                </div>
                <h2 className="tk-form-desktop-title">{step.title}</h2>
                {step.subtitle && (
                  <p className="tk-form-desktop-step-sub">{step.subtitle}</p>
                )}
                {hasError && errorReason && (
                  <p className="tk-form-desktop-error-msg">
                    <AlertCircle size={13} /> {errorReason}
                  </p>
                )}
              </div>
            </div>

            <div className="tk-form-desktop-card-body">
              <StepContent
                stepId={step.id}
                value={value}
                set={set}
                agents={agents}
                communeId={communeId}
                toggleAssignee={toggleAssignee}
                variant="desktop"
              />
            </div>
          </section>
          );
        })}
      </div>

      {showErrors && (
        <div className="tk-form-desktop-missing" role="alert">
          <div className="tk-form-desktop-missing-title">
            <AlertCircle size={16} />
            <span>
              {missingSteps.length} section{missingSteps.length > 1 ? "s" : ""} à compléter avant
              de pouvoir créer le ticket
            </span>
          </div>
          <ul className="tk-form-desktop-missing-list">
            {missingSteps.map((m) => (
              <li key={m.id}>
                <strong>{m.eyebrow}</strong>
                {m.reason ? ` — ${m.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tk-form-desktop-submit">
        <Link href="/admin/tickets" className="civiq-btn civiq-btn-ghost">
          Annuler
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="civiq-btn civiq-btn-default"
          aria-invalid={showErrors ? "true" : undefined}
        >
          {pending ? <Loader2 size={16} className="civiq-spin" /> : <Save size={16} />}
          {pending ? "Création…" : "Créer le ticket"}
        </button>
      </div>
    </main>
  );
}

// ─── Step content router (partagé) ──────────────────────────────

function StepContent({
  stepId,
  value,
  set,
  agents,
  communeId,
  toggleAssignee,
  variant,
}: {
  stepId: WizardStepId;
  value: WizardValue;
  set: <K extends keyof WizardValue>(key: K, val: WizardValue[K]) => void;
  agents: Agent[];
  communeId: string;
  toggleAssignee: (id: string) => void;
  variant: "mobile" | "desktop";
}) {
  switch (stepId) {
    case "canal":
      return (
        <div className={variant === "desktop" ? "tk-options-grid-2" : "tk-wizard-options"}>
          {CANAUX.map((c) => {
            const active = value.canal === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => set("canal", c.value)}
                className="tk-wizard-option"
                aria-pressed={active}
                data-active={active}
              >
                <span className="tk-wizard-option-emoji">{c.emoji}</span>
                <span className="tk-wizard-option-body">
                  <span className="tk-wizard-option-title">{CANAL_LABELS[c.value]}</span>
                  <span className="tk-wizard-option-help">{c.help}</span>
                </span>
                <span className="tk-wizard-radio" aria-hidden>
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      );

    case "demandeur":
      return (
        <div className={variant === "desktop" ? "tk-fields-grid-2" : "tk-wizard-fields"}>
          <Field label="Nom">
            <input
              className="civiq-input"
              value={value.demandeur_nom}
              onChange={(e) => set("demandeur_nom", e.target.value)}
              placeholder="Mme Dupont"
              autoComplete="name"
            />
          </Field>
          <Field label="Téléphone">
            <input
              className="civiq-input"
              type="tel"
              inputMode="tel"
              value={value.demandeur_telephone}
              onChange={(e) => set("demandeur_telephone", e.target.value)}
              placeholder="06 12 34 56 78"
              autoComplete="tel"
            />
          </Field>
          <Field label="Email">
            <input
              className="civiq-input"
              type="email"
              inputMode="email"
              value={value.demandeur_email}
              onChange={(e) => set("demandeur_email", e.target.value)}
              placeholder="dupont@example.fr"
              autoComplete="email"
            />
          </Field>
          <Field label="Adresse">
            <input
              className="civiq-input"
              value={value.demandeur_adresse}
              onChange={(e) => set("demandeur_adresse", e.target.value)}
              placeholder="12 rue X"
              autoComplete="street-address"
            />
          </Field>
        </div>
      );

    case "categorie":
      return <EtapeCategorie value={value} set={set} variant={variant} />;

    case "description":
      return (
        <div className={variant === "desktop" ? "tk-desc-grid" : "tk-wizard-fields"}>
          <Field label="Titre court" required>
            <input
              className="civiq-input"
              value={value.titre}
              onChange={(e) => set("titre", e.target.value)}
              placeholder="Ex : Nid-de-poule rue de la Mairie"
              maxLength={200}
              autoFocus={variant === "mobile"}
            />
            <span className="civiq-hint">{value.titre.length} / 200</span>
          </Field>
          <Field label="Description (optionnel)">
            <textarea
              className="civiq-input civiq-textarea"
              rows={variant === "desktop" ? 5 : 4}
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Détails utiles : gravité observée, accès, etc."
            />
          </Field>
        </div>
      );

    case "priorite":
      return (
        <div className={variant === "desktop" ? "tk-prio-grid-desktop" : "tk-wizard-options"} role="radiogroup" aria-label="Urgence">
          {URGENCES.map((u) => {
            const c = URGENCE_COLORS[u];
            const active = value.urgence === u;
            return (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("urgence", u)}
                className="tk-wizard-option"
                data-active={active}
                style={active ? { borderColor: u === "danger_immediat" ? c.bg : c.fg, background: u === "danger_immediat" ? "#FFF6F7" : c.bg } : undefined}
              >
                <span className="tk-wizard-option-emoji" style={{ background: c.bg, display: "inline-flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: u === "danger_immediat" ? "#fff" : c.fg }} />
                </span>
                <span className="tk-wizard-option-body">
                  <span className="tk-wizard-option-title">{URGENCE_LABELS[u]}</span>
                  <span className="tk-wizard-option-help">{URGENCE_AIDE[u]}</span>
                </span>
                <span className="tk-wizard-radio" aria-hidden>
                  {active && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      );

    case "localisation":
      return (
        <div>
          <TicketLocationPicker
            value={value.location}
            onChange={(loc) => set("location", loc)}
          />
        </div>
      );

    case "photos":
      return (
        <div>
          <TicketPhotoUpload
            communeId={communeId}
            onChange={(paths) => set("photoPaths", paths)}
            max={5}
          />
        </div>
      );

    case "visibilite":
      return <EtapeVisibilite value={value} set={set} />;

    case "assignation":
      return (
        <div className={variant === "desktop" ? "tk-assign-grid" : "tk-wizard-fields"}>
          {agents.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Aucun agent disponible.</p>
          ) : (
            <div className={variant === "desktop" ? "tk-agents-grid-desktop" : "tk-wizard-agents"}>
              {agents.map((a) => {
                const checked = value.assigneIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAssignee(a.id)}
                    className="tk-wizard-agent"
                    aria-pressed={checked}
                    data-active={checked}
                  >
                    <span className="tk-wizard-agent-avatar" aria-hidden>
                      {(a.full_name?.[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="tk-wizard-agent-body">
                      <span className="tk-wizard-agent-name">
                        {a.full_name || "(sans nom)"}
                      </span>
                      {a.job_title && (
                        <span className="tk-wizard-agent-job">
                          {a.job_title.replace("_", " ")}
                        </span>
                      )}
                    </span>
                    <span className="tk-wizard-checkbox" aria-hidden>
                      {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <Field label="Échéance souhaitée (optionnel)">
            <input
              type="date"
              className="civiq-input"
              value={value.echeance}
              onChange={(e) => set("echeance", e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={{ maxWidth: 240 }}
            />
          </Field>
        </div>
      );
  }
}

// ─── Étape « Catégorie » : catégorie puis sous-catégorie (lot 2) ──

function EtapeCategorie({
  value, set, variant,
}: {
  value: WizardValue;
  set: <K extends keyof WizardValue>(key: K, val: WizardValue[K]) => void;
  variant: "mobile" | "desktop";
}) {
  const { categories } = useContext(VisibiliteCtx);
  const arbre = arborescence(categories, { actifsSeulement: true });
  const choisie = categories.find((c) => c.id === value.categorieId) ?? null;
  const racineChoisie = choisie ? (choisie.parent_id ?? choisie.id) : null;
  const [racineOuverte, setRacineOuverte] = useState<string | null>(racineChoisie);
  const racine = arbre.find((r) => r.id === racineOuverte) ?? null;
  const reglages = reglagesEffectifs(value.categorieId, categories);

  function choisir(id: string) {
    set("categorieId", id);
    const r = reglagesEffectifs(id, categories);
    // Préréglages de la catégorie (modifiables aux étapes suivantes)
    set("urgence", r.urgence);
    set("serviceId", r.serviceId ?? "");
    set("confidentialite", r.confidentialite);
  }

  if (arbre.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Aucune catégorie n&apos;est configurée pour cette commune.</p>;
  }

  if (!racine) {
    return (
      <div className={variant === "desktop" ? "tk-cat-grid-desktop" : "tk-wizard-grid"}>
        {arbre.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => { setRacineOuverte(r.id); if (r.enfants.length === 0) choisir(r.id); }}
            className="tk-wizard-cat"
            aria-pressed={racineChoisie === r.id}
            data-active={racineChoisie === r.id}
          >
            <span className="tk-wizard-cat-emoji" aria-hidden><IconeCategorie nom={r.icone} size={22} /></span>
            <span className="tk-wizard-cat-label">{r.libelle}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={() => setRacineOuverte(null)} className="civiq-btn civiq-btn-ghost" style={{ alignSelf: "flex-start", fontSize: 13, padding: "6px 10px" }}>
        ← Toutes les catégories
      </button>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
        <IconeCategorie nom={racine.icone} size={18} /> {racine.libelle}
      </p>
      <div role="radiogroup" aria-label={`Précision : ${racine.libelle}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...racine.enfants, { ...racine, libelle: `Autre (${racine.libelle.toLowerCase()})`, enfants: undefined }].map((c) => {
          const active = value.categorieId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choisir(c.id)}
              className="tk-wizard-option"
              data-active={active}
              style={{ minHeight: 48 }}
            >
              <span className="tk-wizard-option-body">
                <span className="tk-wizard-option-title">{c.libelle}</span>
                {c.urgence_defaut === "danger_immediat" && <span className="tk-wizard-option-help" style={{ color: "var(--destructive)" }}>Danger immédiat</span>}
              </span>
              <span className="tk-wizard-radio" aria-hidden>{active && <Check size={14} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>
      {reglages.consigne && value.categorieId && (
        <div role="alert" style={{ marginTop: 6, padding: 14, borderRadius: "var(--radius)", background: "#FFF6F7", border: "2px solid var(--destructive)", display: "flex", flexDirection: "column", gap: 10 }}>
          <strong style={{ color: "var(--destructive)", display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
            <Siren size={18} aria-hidden="true" /> Mettez-vous en sécurité avant tout
          </strong>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--fg)" }}>{reglages.consigne}</p>
          <a href="tel:112" className="civiq-btn" style={{ background: "var(--destructive)", color: "#fff", justifyContent: "center", fontWeight: 700 }}>Appeler le 112</a>
        </div>
      )}
    </div>
  );
}

// ─── Étape « Service et visibilité » (lot 1) ────────────────────

function EtapeVisibilite({
  value, set,
}: {
  value: WizardValue;
  set: <K extends keyof WizardValue>(key: K, val: WizardValue[K]) => void;
}) {
  const { services, personnes, moi } = useContext(VisibiliteCtx);
  return (
    <div className="tk-wizard-fields" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {services.length > 0 && (
        <Field label="Service qui traite le signalement (optionnel)">
          <select
            className="civiq-input"
            value={value.serviceId}
            onChange={(e) => set("serviceId", e.target.value)}
            style={{ maxWidth: 360 }}
          >
            <option value="">Aucun service pour l&apos;instant</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </Field>
      )}
      <VisibiliteChamps
        niveau={value.confidentialite}
        destinataires={value.destinataireIds}
        personnes={personnes}
        moi={moi}
        onNiveau={(n) => set("confidentialite", n)}
        onDestinataires={(ids) => set("destinataireIds", ids)}
      />
    </div>
  );
}

// ─── Récap sheet (mobile uniquement) ────────────────────────────

function RecapSheet({
  value,
  steps,
  agents,
  pending,
  onEdit,
  onClose,
  onSubmit,
}: {
  value: WizardValue;
  steps: WizardStepId[];
  agents: Agent[];
  pending: boolean;
  onEdit: (id: WizardStepId) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const { categories: categoriesRecap } = useContext(VisibiliteCtx);
  const assigneeNames = value.assigneIds
    .map((id) => agents.find((a) => a.id === id)?.full_name ?? "—")
    .filter(Boolean);

  const rows: Array<{ id: WizardStepId; label: string; value: React.ReactNode }> = [
    { id: "canal", label: "Canal", value: CANAL_LABELS[value.canal] },
  ];
  if (steps.includes("demandeur")) {
    rows.push({
      id: "demandeur",
      label: "Demandeur",
      value:
        [value.demandeur_nom, value.demandeur_telephone, value.demandeur_email]
          .filter((x) => x.trim())
          .join(" · ") || "—",
    });
  }
  rows.push(
    {
      id: "categorie",
      label: "Catégorie",
      value: value.categorieId ? cheminCategorie(value.categorieId, categoriesRecap).libelle : "—",
    },
    { id: "description", label: "Titre", value: value.titre || "—" },
  );
  if (value.description.trim()) {
    rows.push({ id: "description", label: "Description", value: value.description });
  }
  rows.push(
    { id: "priorite", label: "Urgence", value: URGENCE_LABELS[value.urgence] },
    {
      id: "localisation",
      label: "Localisation",
      value:
        value.location.adresse ||
        (value.location.latitude
          ? `${value.location.latitude.toFixed(5)}, ${value.location.longitude?.toFixed(5)}`
          : "—"),
    },
    {
      id: "photos",
      label: "Photos",
      value: value.photoPaths.length
        ? `${value.photoPaths.length} photo${value.photoPaths.length > 1 ? "s" : ""}`
        : "Aucune",
    },
    {
      id: "assignation",
      label: "Assignés",
      value: assigneeNames.length ? assigneeNames.join(", ") : "Non assigné",
    },
    {
      id: "visibilite",
      label: "Visibilité",
      value: value.confidentialite === "standard"
        ? "Standard"
        : `${value.confidentialite === "restreint" ? "Restreint" : "Confidentiel"} · ${value.destinataireIds.length} personne${value.destinataireIds.length > 1 ? "s" : ""}`,
    },
  );

  return (
    <div className="tk-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tk-sheet-handle" />
        <div className="tk-sheet-header">
          <h3>Vérifie avant d&apos;envoyer</h3>
          <button
            type="button"
            onClick={onClose}
            className="tk-wizard-iconbtn"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="tk-sheet-body">
          <ul className="tk-recap">
            {rows.map((r, i) => (
              <li key={i} className="tk-recap-row">
                <div className="tk-recap-row-main">
                  <div className="tk-recap-label">{r.label}</div>
                  <div className="tk-recap-value">{r.value}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(r.id)}
                  className="tk-recap-edit"
                  aria-label={`Modifier ${r.label}`}
                >
                  <PencilLine size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="tk-sheet-footer">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="civiq-btn civiq-btn-default"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {pending ? <Loader2 size={16} className="civiq-spin" /> : <Check size={16} />}
            {pending ? "Création…" : "Créer le ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm quit (mobile uniquement) ───────────────────────────

function ConfirmQuitDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="tk-sheet-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div
        className="tk-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, margin: "auto" }}
      >
        <div className="tk-sheet-handle" />
        <div className="tk-sheet-body" style={{ textAlign: "center" }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
            Quitter sans enregistrer ?
          </h3>
          <p style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Ta saisie en cours sera perdue.
          </p>
        </div>
        <div className="tk-sheet-footer" style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            className="civiq-btn civiq-btn-outline"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Continuer la saisie
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="civiq-btn civiq-btn-default"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field helper ────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="civiq-field-label">
        {label}
        {required && <span className="civiq-required">*</span>}
      </label>
      {children}
    </div>
  );
}

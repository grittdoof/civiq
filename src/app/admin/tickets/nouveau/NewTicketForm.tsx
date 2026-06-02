"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  PencilLine,
  Save,
  X,
} from "lucide-react";
import TicketLocationPicker from "@/components/tickets/TicketLocationPicker";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { createTicket } from "@/lib/tickets/mutations";
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

interface Props {
  communeId: string;
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

export default function NewTicketForm({ communeId, agents }: Props) {
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
    if (!wiz.isValidGlobal || !value.categorie) {
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
          categorie: value.categorie!,
          priorite: value.priorite,
          adresse: value.location.adresse,
          latitude: value.location.latitude,
          longitude: value.location.longitude,
          precision_geo: value.location.precision_geo,
          assignee_ids: value.assigneIds,
          echeance: value.echeance || null,
          photo_paths: value.photoPaths,
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
    );
  }

  return (
    <DesktopForm
      wiz={wiz}
      agents={agents}
      communeId={communeId}
      toggleAssignee={toggleAssignee}
      error={error}
      pending={pending}
      submit={submit}
    />
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
  const { value, set, steps, isValidGlobal } = wiz;

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
        {steps.map((step, i) => (
          <section key={step.id} className="civiq-card tk-form-desktop-card">
            <div className="tk-form-desktop-card-head">
              <span className="tk-form-desktop-num">{i + 1}</span>
              <div>
                <div className="tk-form-desktop-eyebrow">
                  {step.eyebrow}
                  {step.optional && <span className="tk-form-desktop-optional"> · optionnel</span>}
                </div>
                <h2 className="tk-form-desktop-title">{step.title}</h2>
                {step.subtitle && (
                  <p className="tk-form-desktop-step-sub">{step.subtitle}</p>
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
        ))}
      </div>

      <div className="tk-form-desktop-submit">
        <Link href="/admin/tickets" className="civiq-btn civiq-btn-ghost">
          Annuler
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={!isValidGlobal || pending}
          className="civiq-btn civiq-btn-default"
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
      return (
        <div className={variant === "desktop" ? "tk-cat-grid-desktop" : "tk-wizard-grid"}>
          {CATEGORIES.map((c) => {
            const active = value.categorie === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => set("categorie", c)}
                className="tk-wizard-cat"
                aria-pressed={active}
                data-active={active}
              >
                <span className="tk-wizard-cat-emoji" aria-hidden>{CATEGORIE_ICONS[c]}</span>
                <span className="tk-wizard-cat-label">{CATEGORIE_LABELS[c]}</span>
              </button>
            );
          })}
        </div>
      );

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
        <div className={variant === "desktop" ? "tk-prio-grid-desktop" : "tk-wizard-options"}>
          {PRIORITES.map((p) => {
            const c = PRIORITE_COLORS[p.value];
            const active = value.priorite === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => set("priorite", p.value)}
                className="tk-wizard-option"
                aria-pressed={active}
                data-active={active}
                style={active ? { borderColor: c.fg, background: c.bg } : undefined}
              >
                <span
                  className="tk-wizard-option-emoji"
                  style={{
                    background: c.bg,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-hidden
                >
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c.fg }} />
                </span>
                <span className="tk-wizard-option-body">
                  <span className="tk-wizard-option-title">{PRIORITE_LABELS[p.value]}</span>
                  <span className="tk-wizard-option-help">{p.sub}</span>
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
      value: value.categorie ? (
        <>
          {CATEGORIE_ICONS[value.categorie]} {CATEGORIE_LABELS[value.categorie]}
        </>
      ) : "—",
    },
    { id: "description", label: "Titre", value: value.titre || "—" },
  );
  if (value.description.trim()) {
    rows.push({ id: "description", label: "Description", value: value.description });
  }
  rows.push(
    { id: "priorite", label: "Priorité", value: PRIORITE_LABELS[value.priorite] },
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

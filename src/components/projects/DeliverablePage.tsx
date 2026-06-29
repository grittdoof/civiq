"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  ListChecks,
  Users,
  Wallet,
  Flag,
  PencilLine,
  Sparkles,
  Gavel,
  ShieldCheck,
  Megaphone,
  PiggyBank,
  Loader2,
  CheckCircle2,
  MinusCircle,
  RotateCcw,
  ArrowRight,
  Info,
  Save,
} from "lucide-react";
import {
  FINANCING_STATUS_LABELS,
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
} from "@/lib/projects/types";
import type {
  DeliverableKind,
  DeliverableSpec,
  ProjectPhase,
  ProjectCompetence,
  FinancingStatus,
  Stakeholder,
  StakeholderRole,
  StakeholderType,
} from "@/lib/projects/types";
import DocumentsEditor from "./DocumentsEditor";
import ProjectPhotoUpload from "./ProjectPhotoUpload";

// ═══════════════════════════════════════════════════════════════
// DeliverablePage — page focalisée pour un livrable.
//
// Phase B couvre les kinds :
//   - identity   : titre + description + objectifs + photo
//   - document   : DocumentsEditor en mode page
//   - task       : toggle + note libre
//   - field      : champ pilotes (élu + agent) si link=objectifs
//
// Phase C ajoutera : stakeholder, financing, milestone, field étendu.
//
// Structure :
//   header    : badge kind + titre + helpText
//   body      : form contextuel selon kind
//   footer    : Enregistrer / Marquer fait / Plus tard
// ═══════════════════════════════════════════════════════════════

const KIND_LABEL: Record<DeliverableKind, string> = {
  task: "Tâche",
  document: "Document",
  stakeholder: "Partie prenante",
  financing: "Financement",
  milestone: "Jalon",
  field: "À remplir",
  identity: "Identité",
  deliberation: "Délibération",
  authorization: "Autorisation",
  communication: "Communication",
  budget: "Budget",
};

const KIND_ICON: Record<DeliverableKind, typeof FileText> = {
  task: ListChecks,
  document: FileText,
  stakeholder: Users,
  financing: Wallet,
  milestone: Flag,
  field: PencilLine,
  identity: Sparkles,
  deliberation: Gavel,
  authorization: ShieldCheck,
  communication: Megaphone,
  budget: PiggyBank,
};

interface CurrentProject {
  titre: string;
  description: string | null;
  objectifs: string | null;
  competence: ProjectCompetence;
  pilote_elu: string | null;
  pilote_agent: string | null;
  budget_estime: number;
  taux_inflation: number | null;
  taux_actualisation: number | null;
  cout_reel: number | null;
  explication_ecart: string | null;
  photo_url: string | null;
}

const STAKEHOLDER_ROLES: StakeholderRole[] = ["decide", "finance", "execute", "consulte", "informe"];
const STAKEHOLDER_TYPES: StakeholderType[] = ["interne", "institutionnelle", "financeur", "technique", "citoyenne"];
const FINANCING_STATUSES: FinancingStatus[] = ["a_demander", "demandee", "ar_recu", "accordee", "refusee", "soldee"];

interface Props {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  spec: DeliverableSpec;
  manual: { done: boolean; note: string | null; applicable: boolean };
  currentProject: CurrentProject;
  profilesDirectory: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}

export default function DeliverablePage({
  projectId,
  phase,
  deliverableIdx,
  spec,
  manual,
  currentProject,
  profilesDirectory,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: Props) {
  const router = useRouter();
  const Icon = KIND_ICON[spec.kind];
  const [applicable, setApplicable] = useState(manual.applicable);
  const [togglingNa, setTogglingNa] = useState(false);

  async function toggleApplicable() {
    if (togglingNa) return;
    const next = !applicable;
    setTogglingNa(true);
    setApplicable(next);
    try {
      await persistProgress(projectId, phase, deliverableIdx, {
        done: manual.done,
        note: manual.note,
        applicable: next,
      });
      router.refresh();
    } finally {
      setTogglingNa(false);
    }
  }

  return (
    <article className={`pj-deliv-page${!applicable ? " is-na" : ""}`}>
      <header className="pj-deliv-head">
        <span className="pj-deliv-kind-badge">
          <Icon size={12} />
          {KIND_LABEL[spec.kind]}
        </span>
        <h2 className="pj-deliv-title">{spec.label}</h2>
        <p className="pj-deliv-help">{contextHelp(spec.kind)}</p>
        {canEdit && (
          <button
            type="button"
            className="pj-deliv-na-toggle"
            onClick={toggleApplicable}
            disabled={togglingNa}
            title={
              applicable
                ? "Marquer ce livrable comme non applicable à votre projet"
                : "Rétablir ce livrable comme applicable"
            }
          >
            {togglingNa ? (
              <Loader2 size={12} className="spin" />
            ) : applicable ? (
              <MinusCircle size={12} />
            ) : (
              <RotateCcw size={12} />
            )}
            <span>{applicable ? "Marquer non applicable" : "Rétablir comme applicable"}</span>
          </button>
        )}
        {!applicable && (
          <div className="pj-deliv-na-banner" role="status">
            <MinusCircle size={14} aria-hidden />
            <span>
              Livrable marqué <strong>non applicable</strong>. Il ne compte plus
              dans la progression obligatoire de la phase.
            </span>
          </div>
        )}
      </header>

      <div className="pj-deliv-body">
        {spec.kind === "identity" && (
          <IdentityForm
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            current={currentProject}
            manual={manual}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "document" && (
          <DocumentSection
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            manual={manual}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "task" && (
          <TaskForm
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            manual={manual}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "field" && (
          <FieldSection
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            spec={spec}
            current={currentProject}
            manual={manual}
            profilesDirectory={profilesDirectory}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "stakeholder" && (
          <StakeholderSection
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "financing" && (
          <FinancingSection
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {spec.kind === "milestone" && (
          <MilestoneSection
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            profilesDirectory={profilesDirectory}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}
      </div>
    </article>
  );
}

// ─── Help contextuels par kind ───
function contextHelp(kind: DeliverableKind): string {
  switch (kind) {
    case "identity":
      return "Le strict minimum pour faire exister votre projet : nommez-le, racontez ce qu'il vise, et illustrez si vous le pouvez.";
    case "document":
      return "Déposez un ou plusieurs documents en lien avec ce livrable (PDF, photo, plan…). Ils alimentent automatiquement la section Documents de la fiche projet.";
    case "task":
      return "Cochez quand la tâche est terminée. Vous pouvez aussi laisser une note (référence, date, n° de délibération).";
    case "field":
      return "Renseignez l'information directement ici. Elle se retrouvera automatiquement dans la fiche projet.";
    case "stakeholder":
      return "Associez une ou plusieurs personnes au projet avec leur rôle (RACI).";
    case "financing":
      return "Ajoutez une ligne de financement avec son dispositif et son montant.";
    case "milestone":
      return "Ajoutez un jalon avec son échéance et un responsable.";
    default:
      return "";
  }
}

// ─── Footer commun avec actions ───
function ActionFooter({
  primaryLabel,
  onPrimary,
  saving,
  onMarkDoneWithoutData,
  showLater,
  projectId,
  phase,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  primaryLabel: string;
  onPrimary: () => Promise<void> | void;
  saving: boolean;
  onMarkDoneWithoutData?: () => Promise<void> | void;
  showLater?: boolean;
  projectId: string;
  phase: ProjectPhase;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const laterHref =
    nextDeliverableIdx !== null
      ? `/admin/projects/${projectId}/phase/${phase}/${nextDeliverableIdx}`
      : nextPhase
      ? `/admin/projects/${projectId}/phase/${nextPhase}`
      : `/admin/projects/${projectId}/phase/${phase}`;
  return (
    <div className="pj-deliv-footer">
      {showLater !== false && (
        <Link href={laterHref} className="pj-deliv-later" prefetch={false}>
          Plus tard
        </Link>
      )}
      {onMarkDoneWithoutData && canEdit && (
        <button
          type="button"
          className="pj-deliv-mark-done"
          onClick={() => onMarkDoneWithoutData()}
          disabled={saving}
        >
          Marquer comme fait
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          className="pj-deliv-primary"
          onClick={() => onPrimary()}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <Save size={14} />
              {primaryLabel}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Identity (titre, description, objectifs, photo) ───
function IdentityForm({
  projectId,
  phase,
  deliverableIdx,
  current,
  manual,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  current: CurrentProject;
  manual: { done: boolean; note: string | null };
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState(
    current.titre === "Sans titre" ? "" : current.titre,
  );
  const [description, setDescription] = useState(current.description ?? "");
  const [objectifs, setObjectifs] = useState(current.objectifs ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    if (!titre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(),
          description: description.trim() || null,
          objectifs: objectifs.trim() || null,
        }),
      });
      if (!res.ok) {
        setSaving(false);
        return;
      }
      // Marque ce livrable comme fait
      await markDeliverableDone(projectId, phase, deliverableIdx);
      const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
      startTransition(() => router.push(next));
    } catch {
      setSaving(false);
    }
  }

  const canSave = titre.trim().length > 0;

  return (
    <>
      <div className="pj-deliv-field">
        <label htmlFor="d-titre">
          Titre du projet <span className="pj-deliv-required">*</span>
        </label>
        <input
          id="d-titre"
          type="text"
          className="pj-deliv-input"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Réfection de la rue de l'Église"
          autoFocus={canEdit}
          disabled={!canEdit}
          maxLength={140}
        />
      </div>

      <div className="pj-deliv-field">
        <label htmlFor="d-desc">Description courte</label>
        <textarea
          id="d-desc"
          rows={2}
          className="pj-deliv-input pj-deliv-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="En une ou deux phrases : ce que le projet va changer."
          disabled={!canEdit}
        />
      </div>

      <div className="pj-deliv-field">
        <label htmlFor="d-obj">Objectifs détaillés</label>
        <textarea
          id="d-obj"
          rows={4}
          className="pj-deliv-input pj-deliv-textarea"
          value={objectifs}
          onChange={(e) => setObjectifs(e.target.value)}
          placeholder="Quels résultats concrets vous visez. Pour qui. Et pourquoi maintenant."
          disabled={!canEdit}
        />
      </div>

      <div className="pj-deliv-field">
        <label>Photo de couverture (optionnel)</label>
        <ProjectPhotoUpload
          projectId={projectId}
          current={current.photo_url}
          canEdit={canEdit}
        />
      </div>

      <ActionFooter
        primaryLabel={canSave ? "Enregistrer et continuer" : "Renseigner le titre"}
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit && canSave}
      />
    </>
  );
}

// ─── Document (réutilise DocumentsEditor) ───
function DocumentSection({
  projectId,
  phase,
  deliverableIdx,
  manual,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  manual: { done: boolean; note: string | null };
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function markAndAdvance() {
    setSaving(true);
    await markDeliverableDone(projectId, phase, deliverableIdx);
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  return (
    <>
      <DocumentsEditor projectId={projectId} initial={[]} canEdit={canEdit} />

      <div className="pj-deliv-info">
        <Info size={13} />
        <span>
          Dès qu&apos;au moins un document est ajouté, ce livrable est validé
          automatiquement. Vous pouvez aussi le marquer comme fait sans
          document si la pièce existe en dehors de la plateforme.
        </span>
      </div>

      <ActionFooter
        primaryLabel="Continuer"
        onPrimary={markAndAdvance}
        saving={saving}
        onMarkDoneWithoutData={markAndAdvance}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </>
  );
}

// ─── Task (toggle + note) ───
function TaskForm({
  projectId,
  phase,
  deliverableIdx,
  manual,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  manual: { done: boolean; note: string | null };
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(manual.done);
  const [note, setNote] = useState(manual.note ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setSaving(true);
    await persistProgress(projectId, phase, deliverableIdx, {
      done,
      note: note.trim() || null,
    });
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  return (
    <>
      <label className="pj-deliv-task-toggle">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          disabled={!canEdit}
        />
        <span className="pj-deliv-task-toggle-box" aria-hidden>
          {done && <CheckCircle2 size={20} />}
        </span>
        <span className="pj-deliv-task-toggle-label">
          {done
            ? "Cette tâche est terminée."
            : "Cocher quand la tâche est terminée."}
        </span>
      </label>

      <div className="pj-deliv-field">
        <label htmlFor="d-note">Note (optionnel)</label>
        <textarea
          id="d-note"
          rows={3}
          className="pj-deliv-input pj-deliv-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Référence document, n° de délibération, date, contact…"
          disabled={!canEdit}
        />
      </div>

      <ActionFooter
        primaryLabel="Enregistrer et continuer"
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </>
  );
}

// ─── Field : dispatcher selon la section de fiche concernée ───
function FieldSection({
  projectId,
  phase,
  deliverableIdx,
  spec,
  current,
  manual,
  profilesDirectory,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  spec: DeliverableSpec;
  current: CurrentProject;
  manual: { done: boolean; note: string | null };
  profilesDirectory: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  if (spec.link === "lifecycle") {
    return (
      <LifecycleField
        projectId={projectId}
        phase={phase}
        deliverableIdx={deliverableIdx}
        current={current}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    );
  }

  if (spec.link === "bilan") {
    return (
      <BilanField
        projectId={projectId}
        phase={phase}
        deliverableIdx={deliverableIdx}
        current={current}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    );
  }

  return (
    <PilotesField
      projectId={projectId}
      phase={phase}
      deliverableIdx={deliverableIdx}
      current={current}
      manual={manual}
      profilesDirectory={profilesDirectory}
      nextDeliverableIdx={nextDeliverableIdx}
      nextPhase={nextPhase}
      canEdit={canEdit}
    />
  );
}

// ─── Field : pilotes (élu + agent) — link=objectifs ───
function PilotesField({
  projectId,
  phase,
  deliverableIdx,
  current,
  manual,
  profilesDirectory,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  current: CurrentProject;
  manual: { done: boolean; note: string | null };
  profilesDirectory: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [elu, setElu] = useState(current.pilote_elu ?? "");
  const [agent, setAgent] = useState(current.pilote_agent ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const eluTitles = ["maire", "adjoint", "conseiller"];
  const agentTitles = ["dgs", "secretaire", "agent", "agent_technique"];
  const elus = profilesDirectory.filter(
    (p) => p.job_title && eluTitles.includes(p.job_title),
  );
  const agents = profilesDirectory.filter(
    (p) => p.job_title && agentTitles.includes(p.job_title),
  );

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pilote_elu: elu || null,
        pilote_agent: agent || null,
      }),
    });
    if (elu || agent) {
      await markDeliverableDone(projectId, phase, deliverableIdx);
    }
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  return (
    <>
      <div className="pj-deliv-field">
        <label htmlFor="d-elu">Pilote élu</label>
        <select
          id="d-elu"
          className="pj-deliv-input"
          value={elu}
          onChange={(e) => setElu(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">— Aucun pour le moment —</option>
          {elus.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.id}
            </option>
          ))}
        </select>
      </div>

      <div className="pj-deliv-field">
        <label htmlFor="d-agent">Pilote agent</label>
        <select
          id="d-agent"
          className="pj-deliv-input"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          disabled={!canEdit}
        >
          <option value="">— Aucun pour le moment —</option>
          {agents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.id}
            </option>
          ))}
        </select>
      </div>

      <div className="pj-deliv-info">
        <Info size={13} />
        <span>
          Les pilotes sélectionnés seront automatiquement abonnés aux
          notifications du projet.
        </span>
      </div>

      <ActionFooter
        primaryLabel="Enregistrer et continuer"
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </>
  );
}

// ─── Field : cadrage financier simplifié — link=lifecycle ───
function LifecycleField({
  projectId,
  phase,
  deliverableIdx,
  current,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  current: CurrentProject;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(current.budget_estime || ""));
  const [inflation, setInflation] = useState(current.taux_inflation?.toString() ?? "");
  const [actualisation, setActualisation] = useState(current.taux_actualisation?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budget_estime: budget ? Number(budget) : 0,
        taux_inflation: inflation ? Number(inflation) : null,
        taux_actualisation: actualisation ? Number(actualisation) : null,
      }),
    });
    await markDeliverableDone(projectId, phase, deliverableIdx);
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-budget">Budget estimé HT</label>
          <input
            id="d-budget"
            type="number"
            min="0"
            step="100"
            className="pj-deliv-input"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Ex : 85000"
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-inflation">Inflation annuelle (%)</label>
          <input
            id="d-inflation"
            type="number"
            step="0.1"
            className="pj-deliv-input"
            value={inflation}
            onChange={(e) => setInflation(e.target.value)}
            placeholder="Valeur commune par défaut"
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-actualisation">Actualisation annuelle (%)</label>
          <input
            id="d-actualisation"
            type="number"
            step="0.1"
            className="pj-deliv-input"
            value={actualisation}
            onChange={(e) => setActualisation(e.target.value)}
            placeholder="Valeur commune par défaut"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="pj-deliv-info">
        <Info size={13} />
        <span>
          Ce cadrage nourrit le coût global et la comparaison PPI. Les coûts
          détaillés restent disponibles dans la fiche projet avancée.
        </span>
      </div>

      <ActionFooter
        primaryLabel="Enregistrer et continuer"
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </>
  );
}

// ─── Field : bilan financier — link=bilan ───
function BilanField({
  projectId,
  phase,
  deliverableIdx,
  current,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  current: CurrentProject;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [coutReel, setCoutReel] = useState(current.cout_reel?.toString() ?? "");
  const [note, setNote] = useState(current.explication_ecart ?? "");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cout_reel: coutReel ? Number(coutReel) : null,
        explication_ecart: note.trim() || null,
      }),
    });
    if (coutReel || note.trim()) {
      await markDeliverableDone(projectId, phase, deliverableIdx);
    }
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  return (
    <>
      <div className="pj-deliv-field">
        <label htmlFor="d-cout-reel">Coût réel constaté</label>
        <input
          id="d-cout-reel"
          type="number"
          min="0"
          step="100"
          className="pj-deliv-input"
          value={coutReel}
          onChange={(e) => setCoutReel(e.target.value)}
          placeholder="Ex : 91200"
          disabled={!canEdit}
        />
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-ecart">Explication de l'écart</label>
        <textarea
          id="d-ecart"
          rows={4}
          className="pj-deliv-input pj-deliv-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Expliquez les principaux écarts avec le budget initial."
          disabled={!canEdit}
        />
      </div>

      <ActionFooter
        primaryLabel="Enregistrer et continuer"
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit}
      />
    </>
  );
}

// ─── Stakeholder : annuaire + création rapide + RACI ───
function StakeholderSection({
  projectId,
  phase,
  deliverableIdx,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [directory, setDirectory] = useState<Stakeholder[]>([]);
  const [stakeholderId, setStakeholderId] = useState("");
  const [role, setRole] = useState<StakeholderRole>("consulte");
  const [type, setType] = useState<StakeholderType>("institutionnelle");
  const [nom, setNom] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/stakeholders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stakeholders?: Stakeholder[] } | null) => {
        if (data?.stakeholders) setDirectory(data.stakeholders);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    let id = stakeholderId;
    if (mode === "new") {
      const create = await fetch("/api/stakeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: nom.trim(),
          organisation: organisation.trim() || null,
          email: email.trim() || null,
          telephone: telephone.trim() || null,
          type,
        }),
      });
      if (!create.ok) {
        setSaving(false);
        return;
      }
      const data = (await create.json()) as { stakeholder: Stakeholder };
      id = data.stakeholder.id;
    }

    if (!id) {
      setSaving(false);
      return;
    }

    const attach = await fetch(`/api/projects/${projectId}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stakeholder_id: id, role, phase }),
    });
    if (!attach.ok) {
      setSaving(false);
      return;
    }

    await markDeliverableDone(projectId, phase, deliverableIdx);
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  const canSave = mode === "existing" ? Boolean(stakeholderId) : Boolean(nom.trim());

  return (
    <>
      <div className="pj-deliv-segment" role="tablist" aria-label="Type de partie prenante">
        <button
          type="button"
          className={mode === "existing" ? "is-active" : ""}
          onClick={() => setMode("existing")}
          disabled={!canEdit}
        >
          Annuaire
        </button>
        <button
          type="button"
          className={mode === "new" ? "is-active" : ""}
          onClick={() => setMode("new")}
          disabled={!canEdit}
        >
          Nouveau contact
        </button>
      </div>

      {mode === "existing" ? (
        <div className="pj-deliv-field">
          <label htmlFor="d-stakeholder">Partie prenante</label>
          <select
            id="d-stakeholder"
            className="pj-deliv-input"
            value={stakeholderId}
            onChange={(e) => setStakeholderId(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Sélectionner dans l'annuaire</option>
            {directory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}{s.organisation ? ` (${s.organisation})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="pj-deliv-grid">
          <div className="pj-deliv-field">
            <label htmlFor="d-st-name">Nom</label>
            <input id="d-st-name" className="pj-deliv-input" value={nom} onChange={(e) => setNom(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="pj-deliv-field">
            <label htmlFor="d-st-org">Organisation</label>
            <input id="d-st-org" className="pj-deliv-input" value={organisation} onChange={(e) => setOrganisation(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="pj-deliv-field">
            <label htmlFor="d-st-email">Email</label>
            <input id="d-st-email" type="email" className="pj-deliv-input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="pj-deliv-field">
            <label htmlFor="d-st-phone">Téléphone</label>
            <input id="d-st-phone" type="tel" className="pj-deliv-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="pj-deliv-field">
            <label htmlFor="d-st-type">Type</label>
            <select id="d-st-type" className="pj-deliv-input" value={type} onChange={(e) => setType(e.target.value as StakeholderType)} disabled={!canEdit}>
              {STAKEHOLDER_TYPES.map((t) => (
                <option key={t} value={t}>{STAKEHOLDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="pj-deliv-field">
        <label htmlFor="d-st-role">Rôle dans le projet</label>
        <select
          id="d-st-role"
          className="pj-deliv-input"
          value={role}
          onChange={(e) => setRole(e.target.value as StakeholderRole)}
          disabled={!canEdit}
        >
          {STAKEHOLDER_ROLES.map((r) => (
            <option key={r} value={r}>{STAKEHOLDER_ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>

      <div className="pj-deliv-info">
        <Info size={13} />
        <span>Cette association sera rattachée à la phase {PROJECT_PHASE_LABELS[phase]}.</span>
      </div>

      <ActionFooter
        primaryLabel={canSave ? "Associer et continuer" : "Choisir une partie prenante"}
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit && canSave}
      />
    </>
  );
}

// ─── Financing : une ligne de plan de financement ───
function FinancingSection({
  projectId,
  phase,
  deliverableIdx,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [financeur, setFinanceur] = useState("");
  const [dispositif, setDispositif] = useState("");
  const [montant, setMontant] = useState("");
  const [statut, setStatut] = useState<FinancingStatus>("a_demander");
  const [dateDemande, setDateDemande] = useState("");
  const [dateAr, setDateAr] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/financings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financeur: financeur.trim(),
        dispositif: dispositif.trim() || null,
        montant_demande: montant ? Number(montant) : null,
        statut,
        date_demande: dateDemande || null,
        date_ar: dateAr || null,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      return;
    }
    await markDeliverableDone(projectId, phase, deliverableIdx);
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  const canSave = financeur.trim().length > 0;

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-financeur">Financeur</label>
          <input
            id="d-financeur"
            className="pj-deliv-input"
            value={financeur}
            onChange={(e) => setFinanceur(e.target.value)}
            placeholder="Ex : Département, État — DETR"
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-dispositif">Dispositif</label>
          <input
            id="d-dispositif"
            className="pj-deliv-input"
            value={dispositif}
            onChange={(e) => setDispositif(e.target.value)}
            placeholder="Ex : Appel à projets 2026"
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-montant">Montant demandé</label>
          <input
            id="d-montant"
            type="number"
            min="0"
            step="100"
            className="pj-deliv-input"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-statut">Statut</label>
          <select id="d-statut" className="pj-deliv-input" value={statut} onChange={(e) => setStatut(e.target.value as FinancingStatus)} disabled={!canEdit}>
            {FINANCING_STATUSES.map((s) => (
              <option key={s} value={s}>{FINANCING_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-date-demande">Date de demande</label>
          <input id="d-date-demande" type="date" className="pj-deliv-input" value={dateDemande} onChange={(e) => setDateDemande(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-date-ar">Date AR</label>
          <input id="d-date-ar" type="date" className="pj-deliv-input" value={dateAr} onChange={(e) => setDateAr(e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      <ActionFooter
        primaryLabel={canSave ? "Ajouter et continuer" : "Renseigner le financeur"}
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit && canSave}
      />
    </>
  );
}

// ─── Milestone : une étape clé ───
function MilestoneSection({
  projectId,
  phase,
  deliverableIdx,
  profilesDirectory,
  nextDeliverableIdx,
  nextPhase,
  canEdit,
}: {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  profilesDirectory: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [libelle, setLibelle] = useState("");
  const [echeance, setEcheance] = useState("");
  const [responsable, setResponsable] = useState("");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        libelle: libelle.trim(),
        phase,
        echeance: echeance || null,
        responsable_user_id: responsable || null,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      return;
    }
    await markDeliverableDone(projectId, phase, deliverableIdx);
    const next = nextHref(projectId, phase, nextDeliverableIdx, nextPhase);
    startTransition(() => router.push(next));
  }

  const canSave = libelle.trim().length > 0;

  return (
    <>
      <div className="pj-deliv-field">
        <label htmlFor="d-ms-label">Libellé du jalon</label>
        <input
          id="d-ms-label"
          className="pj-deliv-input"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="Ex : Vote des crédits, publication du marché, OS de démarrage"
          disabled={!canEdit}
        />
      </div>

      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-ms-date">Échéance</label>
          <input
            id="d-ms-date"
            type="date"
            className="pj-deliv-input"
            value={echeance}
            onChange={(e) => setEcheance(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-ms-owner">Responsable</label>
          <select
            id="d-ms-owner"
            className="pj-deliv-input"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            disabled={!canEdit}
          >
            <option value="">Non assigné</option>
            {profilesDirectory.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActionFooter
        primaryLabel={canSave ? "Créer et continuer" : "Renseigner le jalon"}
        onPrimary={save}
        saving={saving}
        projectId={projectId}
        phase={phase}
        nextDeliverableIdx={nextDeliverableIdx}
        nextPhase={nextPhase}
        canEdit={canEdit && canSave}
      />
    </>
  );
}

// ─── Helpers ───
async function markDeliverableDone(
  projectId: string,
  phase: ProjectPhase,
  idx: number,
) {
  const r = await fetch(`/api/projects/${projectId}`);
  if (!r.ok) return;
  const data = (await r.json()) as {
    project?: { phase_progress?: Record<string, unknown> };
  };
  const progress = (data.project?.phase_progress ?? {}) as Record<
    string,
    Record<string, { done: boolean; note: string | null }>
  >;
  const phaseObj = { ...(progress[phase] ?? {}) };
  const cur = phaseObj[String(idx)] ?? { done: false, note: null };
  phaseObj[String(idx)] = { ...cur, done: true };
  const next = { ...progress, [phase]: phaseObj };
  await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase_progress: next }),
  });
}

async function persistProgress(
  projectId: string,
  phase: ProjectPhase,
  idx: number,
  entry: { done: boolean; note: string | null; applicable?: boolean },
) {
  const r = await fetch(`/api/projects/${projectId}`);
  if (!r.ok) return;
  const data = (await r.json()) as {
    project?: { phase_progress?: Record<string, unknown> };
  };
  const progress = (data.project?.phase_progress ?? {}) as Record<
    string,
    Record<string, { done: boolean; note: string | null; applicable?: boolean }>
  >;
  const phaseObj = { ...(progress[phase] ?? {}) };
  phaseObj[String(idx)] = entry;
  const next = { ...progress, [phase]: phaseObj };
  await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase_progress: next }),
  });
}

function nextHref(
  projectId: string,
  phase: ProjectPhase,
  nextDeliverableIdx: number | null,
  nextPhase: ProjectPhase | null,
): string {
  if (nextDeliverableIdx !== null) {
    return `/admin/projects/${projectId}/phase/${phase}/${nextDeliverableIdx}`;
  }
  if (nextPhase) {
    return `/admin/projects/${projectId}/phase/${nextPhase}`;
  }
  return `/admin/projects/${projectId}/phase/${phase}`;
}

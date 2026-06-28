"use client";

import { useState, useTransition } from "react";
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
  Loader2,
  CheckCircle2,
  ArrowRight,
  Info,
  Save,
} from "lucide-react";
import type {
  DeliverableKind,
  DeliverableSpec,
  ProjectPhase,
  ProjectCompetence,
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
};

const KIND_ICON: Record<DeliverableKind, typeof FileText> = {
  task: ListChecks,
  document: FileText,
  stakeholder: Users,
  financing: Wallet,
  milestone: Flag,
  field: PencilLine,
  identity: Sparkles,
};

interface CurrentProject {
  titre: string;
  description: string | null;
  objectifs: string | null;
  competence: ProjectCompetence;
  pilote_elu: string | null;
  pilote_agent: string | null;
  photo_url: string | null;
}

interface Props {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  spec: DeliverableSpec;
  manual: { done: boolean; note: string | null };
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
  const Icon = KIND_ICON[spec.kind];

  return (
    <article className="pj-deliv-page">
      <header className="pj-deliv-head">
        <span className="pj-deliv-kind-badge">
          <Icon size={12} />
          {KIND_LABEL[spec.kind]}
        </span>
        <h2 className="pj-deliv-title">{spec.label}</h2>
        <p className="pj-deliv-help">{contextHelp(spec.kind)}</p>
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
          <PilotesField
            projectId={projectId}
            phase={phase}
            deliverableIdx={deliverableIdx}
            current={currentProject}
            manual={manual}
            profilesDirectory={profilesDirectory}
            nextDeliverableIdx={nextDeliverableIdx}
            nextPhase={nextPhase}
            canEdit={canEdit}
          />
        )}

        {(spec.kind === "stakeholder" ||
          spec.kind === "financing" ||
          spec.kind === "milestone") && (
          <ComingSoon kind={spec.kind} />
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

// ─── Placeholder pour kinds Phase C ───
function ComingSoon({ kind }: { kind: DeliverableKind }) {
  return (
    <div className="pj-deliv-info">
      <Info size={14} />
      <span>
        Le formulaire pour le type « {KIND_LABEL[kind]} » arrive dans la
        prochaine livraison. En attendant, vous pouvez ajouter les ressources
        via la fiche projet, ce livrable sera auto-coché.
      </span>
    </div>
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
  entry: { done: boolean; note: string | null },
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

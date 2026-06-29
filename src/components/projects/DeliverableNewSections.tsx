"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import {
  AUTHORIZATION_TYPE_LABELS,
  AUTHORIZATION_STATUS_LABELS,
  COMMUNICATION_CANAL_LABELS,
  COMMUNICATION_STATUS_LABELS,
  BUDGET_CATEGORIE_LABELS,
  type AuthorizationStatus,
  type AuthorizationType,
  type BudgetCategorie,
  type BudgetSens,
  type CommunicationCanal,
  type CommunicationStatus,
  type ProjectPhase,
} from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// Sections de DeliverablePage pour les 4 nouveaux kinds introduits
// par la migration 029 :
//   • deliberation  → DeliberationSection
//   • authorization → AuthorizationSection
//   • communication → CommunicationSection
//   • budget        → BudgetSection
//
// Calqués sur MilestoneSection : formulaire de création one-shot
// qui poste sur l'API dédiée, marque le livrable fait, redirige.
// L'édition/suppression se fait via la fiche projet (à venir).
// ═══════════════════════════════════════════════════════════════

interface CommonProps {
  projectId: string;
  phase: ProjectPhase;
  deliverableIdx: number;
  nextDeliverableIdx: number | null;
  nextPhase: ProjectPhase | null;
  canEdit: boolean;
}

// ─── Helpers partagés ───
async function markDoneAndGo(
  projectId: string,
  phase: ProjectPhase,
  idx: number,
  nextHref: string,
  startTransition: (cb: () => void) => void,
  router: ReturnType<typeof useRouter>,
) {
  // Marque le livrable « fait » dans phase_progress
  try {
    const r = await fetch(`/api/projects/${projectId}`);
    if (r.ok) {
      const data = (await r.json()) as { project?: { phase_progress?: Record<string, unknown> } };
      const progress = (data.project?.phase_progress ?? {}) as Record<
        string,
        Record<string, { done: boolean; note: string | null; applicable?: boolean }>
      >;
      const phaseObj = { ...(progress[phase] ?? {}) };
      const cur = phaseObj[String(idx)] ?? { done: false, note: null };
      phaseObj[String(idx)] = { ...cur, done: true };
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase_progress: { ...progress, [phase]: phaseObj } }),
      });
    }
  } catch { /* best effort */ }
  startTransition(() => router.push(nextHref));
}

function buildNextHref(
  projectId: string,
  phase: ProjectPhase,
  nextDelivIdx: number | null,
  nextPhase: ProjectPhase | null,
): string {
  if (nextDelivIdx !== null) return `/admin/projects/${projectId}/phase/${phase}/${nextDelivIdx}`;
  if (nextPhase) return `/admin/projects/${projectId}/phase/${nextPhase}`;
  return `/admin/projects/${projectId}/phase/${phase}`;
}

// ─── DeliberationSection ───
export function DeliberationSection(p: CommonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dateSeance, setDateSeance] = useState("");
  const [numero, setNumero] = useState("");
  const [objet, setObjet] = useState("");
  const [lienPv, setLienPv] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = Boolean(objet.trim() && dateSeance);

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${p.projectId}/deliberations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: p.phase,
        date_seance: dateSeance,
        numero: numero.trim() || null,
        objet: objet.trim(),
        lien_pv: lienPv.trim() || null,
      }),
    });
    if (!res.ok) { setSaving(false); return; }
    await markDoneAndGo(
      p.projectId, p.phase, p.deliverableIdx,
      buildNextHref(p.projectId, p.phase, p.nextDeliverableIdx, p.nextPhase),
      startTransition, router,
    );
  }

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-delib-date">Date de séance</label>
          <input
            id="d-delib-date"
            type="date"
            className="pj-input"
            value={dateSeance}
            onChange={(e) => setDateSeance(e.target.value)}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-delib-numero">N° de délibération</label>
          <input
            id="d-delib-numero"
            type="text"
            className="pj-input"
            placeholder="2026-03-15-007"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-delib-objet">Objet</label>
        <textarea
          id="d-delib-objet"
          className="pj-textarea"
          rows={3}
          placeholder="Délibération de principe relative à…"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
        />
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-delib-pv">Lien vers le PV (optionnel)</label>
        <input
          id="d-delib-pv"
          type="url"
          className="pj-input"
          placeholder="https://…"
          value={lienPv}
          onChange={(e) => setLienPv(e.target.value)}
        />
      </div>
      <SaveBar canEdit={p.canEdit} canSave={canSave} saving={saving} onSave={save} />
    </>
  );
}

// ─── AuthorizationSection ───
export function AuthorizationSection(p: CommonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [type, setType] = useState<AuthorizationType>("arrete_municipal");
  const [libelle, setLibelle] = useState("");
  const [statut, setStatut] = useState<AuthorizationStatus>("a_obtenir");
  const [echeance, setEcheance] = useState("");
  const [obtenuLe, setObtenuLe] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = libelle.trim().length > 0;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${p.projectId}/authorizations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: p.phase,
        type,
        libelle: libelle.trim(),
        statut,
        echeance: echeance || null,
        obtenu_le: obtenuLe || null,
      }),
    });
    if (!res.ok) { setSaving(false); return; }
    await markDoneAndGo(
      p.projectId, p.phase, p.deliverableIdx,
      buildNextHref(p.projectId, p.phase, p.nextDeliverableIdx, p.nextPhase),
      startTransition, router,
    );
  }

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-auth-type">Type</label>
          <select
            id="d-auth-type"
            className="pj-input"
            value={type}
            onChange={(e) => setType(e.target.value as AuthorizationType)}
          >
            {(Object.keys(AUTHORIZATION_TYPE_LABELS) as AuthorizationType[]).map((t) => (
              <option key={t} value={t}>{AUTHORIZATION_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-auth-statut">Statut</label>
          <select
            id="d-auth-statut"
            className="pj-input"
            value={statut}
            onChange={(e) => setStatut(e.target.value as AuthorizationStatus)}
          >
            {(Object.keys(AUTHORIZATION_STATUS_LABELS) as AuthorizationStatus[]).map((s) => (
              <option key={s} value={s}>{AUTHORIZATION_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-auth-libelle">Libellé</label>
        <input
          id="d-auth-libelle"
          type="text"
          className="pj-input"
          placeholder="Arrêté d'occupation du domaine public"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
        />
      </div>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-auth-echeance">Échéance (date butoir)</label>
          <input
            id="d-auth-echeance"
            type="date"
            className="pj-input"
            value={echeance}
            onChange={(e) => setEcheance(e.target.value)}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-auth-obtenu">Obtenu le</label>
          <input
            id="d-auth-obtenu"
            type="date"
            className="pj-input"
            value={obtenuLe}
            onChange={(e) => setObtenuLe(e.target.value)}
          />
        </div>
      </div>
      <SaveBar canEdit={p.canEdit} canSave={canSave} saving={saving} onSave={save} />
    </>
  );
}

// ─── CommunicationSection ───
export function CommunicationSection(p: CommonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [canal, setCanal] = useState<CommunicationCanal>("affiche");
  const [libelle, setLibelle] = useState("");
  const [statut, setStatut] = useState<CommunicationStatus>("a_faire");
  const [datePrevue, setDatePrevue] = useState("");
  const [lien, setLien] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = libelle.trim().length > 0;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${p.projectId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: p.phase,
        canal,
        libelle: libelle.trim(),
        statut,
        date_prevue: datePrevue || null,
        lien: lien.trim() || null,
      }),
    });
    if (!res.ok) { setSaving(false); return; }
    await markDoneAndGo(
      p.projectId, p.phase, p.deliverableIdx,
      buildNextHref(p.projectId, p.phase, p.nextDeliverableIdx, p.nextPhase),
      startTransition, router,
    );
  }

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-com-canal">Canal</label>
          <select
            id="d-com-canal"
            className="pj-input"
            value={canal}
            onChange={(e) => setCanal(e.target.value as CommunicationCanal)}
          >
            {(Object.keys(COMMUNICATION_CANAL_LABELS) as CommunicationCanal[]).map((c) => (
              <option key={c} value={c}>{COMMUNICATION_CANAL_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-com-statut">Statut</label>
          <select
            id="d-com-statut"
            className="pj-input"
            value={statut}
            onChange={(e) => setStatut(e.target.value as CommunicationStatus)}
          >
            {(Object.keys(COMMUNICATION_STATUS_LABELS) as CommunicationStatus[]).map((s) => (
              <option key={s} value={s}>{COMMUNICATION_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-com-libelle">Libellé</label>
        <input
          id="d-com-libelle"
          type="text"
          className="pj-input"
          placeholder="Affiche fête de la musique"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
        />
      </div>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-com-date">Date prévue</label>
          <input
            id="d-com-date"
            type="date"
            className="pj-input"
            value={datePrevue}
            onChange={(e) => setDatePrevue(e.target.value)}
          />
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-com-lien">Lien vers l'asset</label>
          <input
            id="d-com-lien"
            type="url"
            className="pj-input"
            placeholder="https://…"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
          />
        </div>
      </div>
      <SaveBar canEdit={p.canEdit} canSave={canSave} saving={saving} onSave={save} />
    </>
  );
}

// ─── BudgetSection ───
export function BudgetSection(p: CommonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sens, setSens] = useState<BudgetSens>("depense");
  const [categorie, setCategorie] = useState<BudgetCategorie | "">("");
  const [libelle, setLibelle] = useState("");
  const [montantPrevu, setMontantPrevu] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = libelle.trim().length > 0;

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${p.projectId}/budget-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: p.phase,
        sens,
        categorie: categorie || null,
        libelle: libelle.trim(),
        montant_prevu: montantPrevu ? Number(montantPrevu) : null,
      }),
    });
    if (!res.ok) { setSaving(false); return; }
    await markDoneAndGo(
      p.projectId, p.phase, p.deliverableIdx,
      buildNextHref(p.projectId, p.phase, p.nextDeliverableIdx, p.nextPhase),
      startTransition, router,
    );
  }

  return (
    <>
      <div className="pj-deliv-grid">
        <div className="pj-deliv-field">
          <label htmlFor="d-bud-sens">Sens</label>
          <select
            id="d-bud-sens"
            className="pj-input"
            value={sens}
            onChange={(e) => setSens(e.target.value as BudgetSens)}
          >
            <option value="depense">Dépense</option>
            <option value="recette">Recette</option>
          </select>
        </div>
        <div className="pj-deliv-field">
          <label htmlFor="d-bud-cat">Catégorie</label>
          <select
            id="d-bud-cat"
            className="pj-input"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as BudgetCategorie | "")}
          >
            <option value="">— Choisir —</option>
            {(Object.keys(BUDGET_CATEGORIE_LABELS) as BudgetCategorie[]).map((c) => (
              <option key={c} value={c}>{BUDGET_CATEGORIE_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-bud-libelle">Libellé</label>
        <input
          id="d-bud-libelle"
          type="text"
          className="pj-input"
          placeholder="Location de barnums"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
        />
      </div>
      <div className="pj-deliv-field">
        <label htmlFor="d-bud-mp">Montant prévu (€)</label>
        <input
          id="d-bud-mp"
          type="number"
          className="pj-input"
          placeholder="0"
          step="0.01"
          value={montantPrevu}
          onChange={(e) => setMontantPrevu(e.target.value)}
        />
      </div>
      <SaveBar canEdit={p.canEdit} canSave={canSave} saving={saving} onSave={save} />
    </>
  );
}

// ─── SaveBar partagé ───
function SaveBar({
  canEdit, canSave, saving, onSave,
}: { canEdit: boolean; canSave: boolean; saving: boolean; onSave: () => void }) {
  if (!canEdit) return null;
  return (
    <div className="pj-deliv-footer" style={{ marginTop: 18 }}>
      <button
        type="button"
        className="pj-deliv-primary"
        onClick={onSave}
        disabled={saving || !canSave}
      >
        {saving ? (
          <><Loader2 size={14} className="spin" /> Enregistrement…</>
        ) : (
          <><Save size={14} /> Enregistrer et continuer</>
        )}
      </button>
    </div>
  );
}

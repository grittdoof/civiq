"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, FilePlus, Flag, Loader2, X, Upload,
} from "lucide-react";
import type { ProjectPhase } from "@/lib/projects/types";

// ═══════════════════════════════════════════════════════════════
// PhaseFreeAdditions — boutons libres « + document » et « + étape
// clé » présents sur chaque page de phase, quel que soit le gabarit.
//
// Brief : « si le projet ne rentre pas dans le moule, l'utilisateur
// modélise sa propre logique avec ces deux briques sans être bloqué ».
//
// Ces ajouts enrichissent la fiche projet mais N'ENTRENT PAS dans
// le « reste à faire » obligatoire (le calcul de progression ne se
// fait que sur les livrables suggérés du gabarit).
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  phase: ProjectPhase;
  canEdit: boolean;
}

type Mode = "closed" | "milestone" | "document";

export default function PhaseFreeAdditions({ projectId, phase, canEdit }: Props) {
  const [mode, setMode] = useState<Mode>("closed");
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!canEdit) return null;

  return (
    <section className="pj-free-additions" aria-label="Ajouts libres à cette phase">
      <div className="pj-free-additions-buttons" hidden={mode !== "closed"}>
        <button
          type="button"
          className="pj-free-add-btn"
          onClick={() => setMode("milestone")}
        >
          <Plus size={14} />
          <Flag size={14} aria-hidden />
          <span>Ajouter une étape clé</span>
        </button>
        <button
          type="button"
          className="pj-free-add-btn"
          onClick={() => setMode("document")}
        >
          <Plus size={14} />
          <FilePlus size={14} aria-hidden />
          <span>Ajouter un document</span>
        </button>
      </div>

      {mode === "milestone" && (
        <MilestoneForm
          projectId={projectId}
          phase={phase}
          onDone={() => {
            setMode("closed");
            startTransition(() => router.refresh());
          }}
          onCancel={() => setMode("closed")}
        />
      )}

      {mode === "document" && (
        <DocumentForm
          projectId={projectId}
          onDone={() => {
            setMode("closed");
            startTransition(() => router.refresh());
          }}
          onCancel={() => setMode("closed")}
        />
      )}
    </section>
  );
}

// ─── Form étape clé ───
function MilestoneForm({
  projectId,
  phase,
  onDone,
  onCancel,
}: {
  projectId: string;
  phase: ProjectPhase;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [libelle, setLibelle] = useState("");
  const [echeance, setEcheance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!libelle.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          libelle: libelle.trim(),
          echeance: echeance || null,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Erreur lors de l'enregistrement");
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  }

  return (
    <form className="pj-free-form" onSubmit={submit}>
      <div className="pj-free-form-head">
        <Flag size={14} />
        <strong>Nouvelle étape clé</strong>
        <button
          type="button"
          className="pj-free-form-close"
          onClick={onCancel}
          aria-label="Annuler"
        >
          <X size={14} />
        </button>
      </div>
      <label className="civiq-field-label">Libellé</label>
      <input
        type="text"
        value={libelle}
        onChange={(e) => setLibelle(e.target.value)}
        className="civiq-input"
        placeholder="Ex. : Réunion de coordination du 12 mai"
        autoFocus
        required
      />
      <label className="civiq-field-label" style={{ marginTop: 10 }}>
        Échéance <span style={{ fontWeight: 400, opacity: 0.6 }}>(facultatif)</span>
      </label>
      <input
        type="date"
        value={echeance}
        onChange={(e) => setEcheance(e.target.value)}
        className="civiq-input"
      />
      {error && <p className="pj-free-form-error">{error}</p>}
      <div className="pj-free-form-actions">
        <button
          type="button"
          className="civiq-btn civiq-btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="civiq-btn"
          disabled={saving || !libelle.trim()}
        >
          {saving ? <><Loader2 size={13} className="spin" /> Enregistrement…</> : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

// ─── Form document (upload fichier) ───
function DocumentForm({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("nom", nom.trim() || file.name);
      fd.append("type", "autre");
      const r = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Erreur lors de l'upload");
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError("Erreur réseau");
      setSaving(false);
    }
  }

  return (
    <form className="pj-free-form" onSubmit={submit}>
      <div className="pj-free-form-head">
        <FilePlus size={14} />
        <strong>Nouveau document</strong>
        <button
          type="button"
          className="pj-free-form-close"
          onClick={onCancel}
          aria-label="Annuler"
        >
          <X size={14} />
        </button>
      </div>
      <label className="civiq-field-label">Fichier</label>
      <input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f && !nom) setNom(f.name.replace(/\.[^.]+$/, ""));
        }}
        className="civiq-input"
        required
      />
      <label className="civiq-field-label" style={{ marginTop: 10 }}>
        Nom affiché <span style={{ fontWeight: 400, opacity: 0.6 }}>(facultatif)</span>
      </label>
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="civiq-input"
        placeholder={file?.name ?? "Nom du document"}
      />
      {error && <p className="pj-free-form-error">{error}</p>}
      <div className="pj-free-form-actions">
        <button
          type="button"
          className="civiq-btn civiq-btn-ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="civiq-btn"
          disabled={saving || !file}
        >
          {saving ? <><Loader2 size={13} className="spin" /> <Upload size={13} /> Upload…</> : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

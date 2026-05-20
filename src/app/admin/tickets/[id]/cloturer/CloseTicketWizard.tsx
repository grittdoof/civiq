"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Camera, FileText, CheckCircle2,
  Loader2, AlertCircle, ImageIcon, Paperclip, Ban, CalendarClock,
} from "lucide-react";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { closeTicketWithReport } from "@/lib/tickets/mutations";
import type { TicketRapport } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// CloseTicketWizard — version simplifiée 3 étapes
//
//   1. Pièce jointe : photo OU document OU « pas nécessaire »
//   2. Suivi ultérieur : checkbox + date de réouverture
//   3. Récapitulatif + clôture
//
// Pensé pour ~60 secondes en pleine intervention sur mobile.
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  ticketTitre: string;
  communeId: string;
  existingRapport?: TicketRapport;
}

type AttachmentMode = "photo" | "document" | "none";

const STEPS = [
  { num: 1, label: "Pièce jointe", icon: <Camera size={14} /> },
  { num: 2, label: "Suivi", icon: <CalendarClock size={14} /> },
  { num: 3, label: "Récapitulatif", icon: <CheckCircle2 size={14} /> },
];

export default function CloseTicketWizard({
  ticketId, ticketNumero, ticketTitre, communeId, existingRapport,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 : Pièce jointe ──
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>("photo");
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [documentPaths, setDocumentPaths] = useState<string[]>([]);

  // ── Step 2 : Suivi ──
  const [necessiteSuivi, setNecessiteSuivi] = useState(existingRapport?.necessite_suivi ?? false);
  const [reopenDate, setReopenDate] = useState<string>("");
  const [notesSuivi, setNotesSuivi] = useState(existingRapport?.notes_suivi ?? "");

  // ── Description (optionnelle, sur la même étape que le récap) ──
  const [description, setDescription] = useState(existingRapport?.description_intervention ?? "");

  function next() {
    setError(null);
    if (step === 1) {
      if (attachmentMode === "photo" && photoPaths.length === 0) {
        setError("Ajoutez au moins une photo, ou choisissez une autre option.");
        return;
      }
      if (attachmentMode === "document" && documentPaths.length === 0) {
        setError("Ajoutez au moins un document, ou choisissez une autre option.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (necessiteSuivi && !reopenDate) {
        setError("Choisissez une date de réouverture pour le suivi.");
        return;
      }
      // Vérif date dans le futur
      if (necessiteSuivi && reopenDate) {
        const d = new Date(reopenDate);
        if (d.getTime() <= Date.now()) {
          setError("La date de réouverture doit être dans le futur.");
          return;
        }
      }
      setStep(3);
    }
  }
  function prev() {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as 1 | 2);
  }

  function submit(finalStatut: "resolu" | "clos") {
    setError(null);
    startTransition(async () => {
      try {
        await closeTicketWithReport({
          ticketId,
          servicePhotoPaths: attachmentMode === "photo" ? photoPaths : [],
          documentPaths: attachmentMode === "document" ? documentPaths : [],
          sansPieceJointe: attachmentMode === "none",
          description_intervention: description,
          necessite_suivi: necessiteSuivi,
          notes_suivi: necessiteSuivi ? notesSuivi : null,
          reopen_at: necessiteSuivi && reopenDate ? new Date(reopenDate).toISOString() : null,
          finalStatut,
        });
        router.push(`/admin/tickets/${ticketId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  // Date minimum = demain (HTML date input)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <main className="civiq-main" style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href={`/admin/tickets/${ticketId}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 14 }}
      >
        <ArrowLeft size={14} /> Retour au ticket #{ticketNumero}
      </Link>

      <header style={{ marginBottom: 18 }}>
        <h1 className="civiq-page-title">Clôturer le ticket</h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--fg-xmuted)" }}>#{ticketNumero}</span> · {ticketTitre}
        </p>
      </header>

      {/* Stepper */}
      <div className="tk-wizard-stepper">
        {STEPS.map((s, i) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div key={s.num} className="tk-wizard-step">
              <div
                className={`tk-wizard-step-circle${active ? " active" : ""}${done ? " done" : ""}`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckCircle2 size={14} /> : s.num}
              </div>
              <span className={`tk-wizard-step-label${active ? " active" : ""}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className={`tk-wizard-step-line${done ? " done" : ""}`} />}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 14 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </div>
      )}

      <div className="civiq-card" style={{ padding: 18 }}>
        {/* ─── STEP 1 : Pièce jointe ─── */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>
              <Paperclip size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Pièce jointe au rapport
            </h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Choisissez l&apos;une des trois options ci-dessous pour documenter l&apos;intervention.
            </p>

            {/* RadioGroup : 3 options */}
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              <ModeOption
                mode="photo"
                current={attachmentMode}
                onSelect={setAttachmentMode}
                icon={<Camera size={16} />}
                title="Ajouter une photo"
                subtitle="Preuve photographique de l'intervention"
              />
              <ModeOption
                mode="document"
                current={attachmentMode}
                onSelect={setAttachmentMode}
                icon={<FileText size={16} />}
                title="Ajouter un document"
                subtitle="Devis, facture, bon d'intervention, PV…"
              />
              <ModeOption
                mode="none"
                current={attachmentMode}
                onSelect={setAttachmentMode}
                icon={<Ban size={16} />}
                title="Pas de pièce nécessaire"
                subtitle="Cette intervention ne requiert ni photo ni document"
              />
            </div>

            {/* Zone d'upload conditionnelle */}
            {attachmentMode === "photo" && (
              <TicketPhotoUpload
                communeId={communeId}
                onChange={setPhotoPaths}
                max={5}
                type="service_fait"
              />
            )}
            {attachmentMode === "document" && (
              <DocumentUpload
                communeId={communeId}
                onChange={setDocumentPaths}
              />
            )}
            {attachmentMode === "none" && (
              <div style={{ padding: 12, background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                ✓ L&apos;intervention sera archivée sans pièce jointe. La description ci-dessous sera votre seule trace écrite.
              </div>
            )}
          </>
        )}

        {/* ─── STEP 2 : Suivi ultérieur ─── */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>
              <CalendarClock size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Un suivi est-il à prévoir ?
            </h2>

            <label
              style={{
                display: "flex", gap: 10, padding: "12px 14px",
                borderRadius: "var(--radius-sm)", cursor: "pointer",
                background: necessiteSuivi ? "var(--accent-light)" : "var(--bg)",
                border: `1px solid ${necessiteSuivi ? "var(--accent)" : "var(--border)"}`,
                marginBottom: 12,
              }}
            >
              <input
                type="checkbox"
                checked={necessiteSuivi}
                onChange={(e) => setNecessiteSuivi(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  Nécessite un suivi ultérieur
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3, lineHeight: 1.5 }}>
                  Le ticket sera automatiquement rouvert à la date choisie, et les agents assignés recevront une notification (mobile + email).
                </div>
              </div>
            </label>

            {necessiteSuivi && (
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Date de réouverture">
                  <input
                    type="date"
                    className="civiq-input"
                    min={tomorrow}
                    value={reopenDate}
                    onChange={(e) => setReopenDate(e.target.value)}
                  />
                </Field>
                <Field label="Notes pour le suivi (optionnel)">
                  <textarea
                    className="civiq-input civiq-textarea"
                    rows={3}
                    value={notesSuivi}
                    onChange={(e) => setNotesSuivi(e.target.value)}
                    placeholder="Ex : Vérifier la prise de l'enrobé, contrôler la peinture, etc."
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {/* ─── STEP 3 : Récapitulatif + clôture ─── */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>
              <CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--success)" }} />
              Récapitulatif
            </h2>

            <div style={{ display: "grid", gap: 14, marginBottom: 18 }}>
              <Recap label="Pièce jointe">
                {attachmentMode === "photo" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ImageIcon size={13} /> {photoPaths.length} photo{photoPaths.length > 1 ? "s" : ""}
                  </span>
                )}
                {attachmentMode === "document" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <FileText size={13} /> {documentPaths.length} document{documentPaths.length > 1 ? "s" : ""}
                  </span>
                )}
                {attachmentMode === "none" && (
                  <span style={{ color: "var(--fg-muted)", fontStyle: "italic" }}>
                    Sans pièce jointe
                  </span>
                )}
              </Recap>

              {/* Description : éditable à l'étape récap */}
              <div>
                <label className="civiq-field-label" style={{ fontSize: 12 }}>
                  Description de l&apos;intervention (optionnel)
                </label>
                <textarea
                  className="civiq-input civiq-textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détaillez ce qui a été fait…"
                />
              </div>

              {necessiteSuivi && reopenDate && (
                <Recap label="Réouverture programmée">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <CalendarClock size={13} style={{ color: "var(--accent)" }} />
                    {new Date(reopenDate).toLocaleDateString("fr-FR", {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                  </span>
                  {notesSuivi && (
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4, fontStyle: "italic" }}>
                      {notesSuivi}
                    </div>
                  )}
                </Recap>
              )}
            </div>

            {/* Bouton unique : Clôturer */}
            <button
              type="button"
              onClick={() => submit("clos")}
              disabled={pending}
              className="civiq-btn civiq-btn-default"
              style={{ width: "100%", padding: "12px 16px", fontSize: 14 }}
            >
              {pending ? <Loader2 size={14} className="civiq-spin" /> : <CheckCircle2 size={14} />}
              {pending ? "Clôture en cours…" : "Clôturer le ticket"}
            </button>
          </>
        )}

        {/* Navigation wizard */}
        {step < 3 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={prev}
              disabled={step === 1 || pending}
              className="civiq-btn civiq-btn-ghost"
              style={{ visibility: step === 1 ? "hidden" : undefined }}
            >
              <ArrowLeft size={14} /> Précédent
            </button>
            <button
              type="button"
              onClick={next}
              disabled={pending}
              className="civiq-btn civiq-btn-default"
            >
              Continuer <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .tk-wizard-stepper {
          display: flex; align-items: center;
          margin: 16px 0 22px;
          flex-wrap: wrap; gap: 4px;
        }
        .tk-wizard-step {
          display: flex; align-items: center; gap: 8px;
          flex: 1; min-width: 0;
        }
        .tk-wizard-step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--card); border: 1.5px solid var(--border);
          color: var(--fg-muted);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          flex-shrink: 0;
          transition: background var(--transition), border-color var(--transition), color var(--transition);
        }
        .tk-wizard-step-circle.active {
          background: var(--accent); border-color: var(--accent); color: #fff;
        }
        .tk-wizard-step-circle.done {
          background: var(--success); border-color: var(--success); color: #fff;
        }
        .tk-wizard-step-label {
          font-size: 12.5px; font-weight: 500; color: var(--fg-muted);
          white-space: nowrap;
        }
        .tk-wizard-step-label.active {
          color: var(--fg); font-weight: 600;
        }
        .tk-wizard-step-line {
          flex: 1; height: 2px; background: var(--border);
          min-width: 12px;
          transition: background var(--transition);
        }
        .tk-wizard-step-line.done { background: var(--success); }

        @media (max-width: 600px) {
          .tk-wizard-step-label { display: none; }
        }
      `}</style>
    </main>
  );
}

function ModeOption({
  mode, current, onSelect, icon, title, subtitle,
}: {
  mode: AttachmentMode;
  current: AttachmentMode;
  onSelect: (m: AttachmentMode) => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const active = current === mode;
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      style={{
        display: "flex", gap: 12, alignItems: "flex-start",
        padding: "12px 14px", textAlign: "left",
        background: active ? "var(--accent-light)" : "var(--card)",
        border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        cursor: "pointer", width: "100%",
        fontFamily: "inherit",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "var(--radius-sm)",
        background: active ? "var(--accent)" : "var(--border-light)",
        color: active ? "#fff" : "var(--fg-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "var(--accent)" : "transparent",
        flexShrink: 0, marginTop: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
      </div>
    </button>
  );
}

/**
 * Upload de documents PDF/Word/Excel pour le rapport d'intervention.
 * Stockés dans le bucket Storage sous tickets/{communeId}/rapports/.
 */
function DocumentUpload({
  communeId, onChange,
}: {
  communeId: string;
  onChange: (paths: string[]) => void;
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setErr(null);

    try {
      const newPaths: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `tickets/${communeId}/rapports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const fd = new FormData();
        fd.append("file", file);
        fd.append("path", path);
        const res = await fetch("/api/tickets/upload-document", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Échec de l'upload");
        }
        const { path: stored } = await res.json();
        newPaths.push(stored);
      }
      const updated = [...paths, ...newPaths];
      setPaths(updated);
      onChange(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function remove(idx: number) {
    const updated = paths.filter((_, i) => i !== idx);
    setPaths(updated);
    onChange(updated);
  }

  return (
    <div>
      <label
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "16px", border: "1.5px dashed var(--border)",
          borderRadius: "var(--radius-sm)", cursor: "pointer",
          background: "var(--bg)", color: "var(--fg-muted)",
          fontSize: 13, fontWeight: 500,
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <Paperclip size={16} />
        {uploading ? "Upload en cours…" : "Choisir un document (PDF, Word, Excel…)"}
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.odt,.ods"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>

      {err && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "oklch(0.97 0.04 25)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 12 }}>
          {err}
        </div>
      )}

      {paths.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {paths.map((p, i) => (
            <div
              key={p}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", background: "var(--card)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                fontSize: 13,
              }}
            >
              <FileText size={14} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
              <span style={{ flex: 1, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.split("/").pop()}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                style={{
                  background: "transparent", border: "none", color: "var(--destructive)",
                  cursor: "pointer", fontSize: 12, padding: 4,
                }}
                aria-label="Supprimer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="civiq-field-label" style={{ fontSize: 12 }}>{label}</label>
      {children}
    </div>
  );
}

function Recap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {children}
      </div>
    </div>
  );
}

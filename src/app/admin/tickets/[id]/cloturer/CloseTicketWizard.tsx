"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Camera, FileText, CheckCircle2,
  Loader2, AlertCircle, ImageIcon,
} from "lucide-react";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { closeTicketWithReport } from "@/lib/tickets/mutations";
import type { TicketRapport } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// CloseTicketWizard — 3 étapes
//
//   1. Photo « service fait » (au moins 1, obligatoire)
//   2. Rapport (description + durée + matériaux + coût + suivi)
//   3. Validation (récap + choix résolu / clos définitivement)
//
// UX mobile-first : pensé pour 90 secondes en pleine intervention.
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  ticketTitre: string;
  communeId: string;
  existingRapport?: TicketRapport;
}

const STEPS = [
  { num: 1, label: "Photo service fait", icon: <Camera size={14} /> },
  { num: 2, label: "Rapport", icon: <FileText size={14} /> },
  { num: 3, label: "Validation", icon: <CheckCircle2 size={14} /> },
];

export default function CloseTicketWizard({
  ticketId, ticketNumero, ticketTitre, communeId, existingRapport,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);

  // Step 2
  const [description, setDescription] = useState(existingRapport?.description_intervention ?? "");
  const [duree, setDuree] = useState<string>(existingRapport?.duree_minutes?.toString() ?? "");
  const [materiaux, setMateriaux] = useState(existingRapport?.materiaux_utilises ?? "");
  const [cout, setCout] = useState<string>(existingRapport?.cout_estime?.toString() ?? "");
  const [necessiteSuivi, setNecessiteSuivi] = useState(existingRapport?.necessite_suivi ?? false);
  const [notesSuivi, setNotesSuivi] = useState(existingRapport?.notes_suivi ?? "");

  function next() {
    setError(null);
    if (step === 1) {
      if (photoPaths.length === 0) {
        setError("Au moins une photo « service fait » est requise.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
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
          servicePhotoPaths: photoPaths,
          description_intervention: description,
          duree_minutes: duree ? Number(duree) : null,
          materiaux_utilises: materiaux,
          cout_estime: cout ? Number(cout) : null,
          necessite_suivi: necessiteSuivi,
          notes_suivi: necessiteSuivi ? notesSuivi : null,
          finalStatut,
        });
        router.push(`/admin/tickets/${ticketId}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

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
        {/* ─── STEP 1 : Photo service fait ─── */}
        {step === 1 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>
              <Camera size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Photo « service fait »
            </h2>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 14, lineHeight: 1.5 }}>
              Prenez au moins une photo après intervention. Cette preuve fait partie du rapport et sera conservée avec le ticket.
            </p>
            <TicketPhotoUpload
              communeId={communeId}
              onChange={setPhotoPaths}
              max={5}
              type="service_fait"
            />
          </>
        )}

        {/* ─── STEP 2 : Rapport ─── */}
        {step === 2 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>
              <FileText size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
              Rapport d&apos;intervention
            </h2>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Description de l'intervention">
                <textarea
                  className="civiq-input civiq-textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Détaillez ce qui a été fait, les difficultés rencontrées, etc."
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <Field label="Durée (minutes)">
                  <input
                    type="number"
                    min={0}
                    className="civiq-input"
                    value={duree}
                    onChange={(e) => setDuree(e.target.value)}
                    placeholder="60"
                  />
                </Field>
                <Field label="Coût estimé (€)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="civiq-input"
                    value={cout}
                    onChange={(e) => setCout(e.target.value)}
                    placeholder="120.00"
                  />
                </Field>
              </div>

              <Field label="Matériaux utilisés">
                <textarea
                  className="civiq-input civiq-textarea"
                  rows={2}
                  value={materiaux}
                  onChange={(e) => setMateriaux(e.target.value)}
                  placeholder="2 sacs d'enrobé à froid, peinture jaune routière…"
                />
              </Field>

              <label
                style={{
                  display: "flex", gap: 10, padding: "10px 12px",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  background: necessiteSuivi ? "var(--accent-light)" : "var(--bg)",
                  border: `1px solid ${necessiteSuivi ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={necessiteSuivi}
                  onChange={(e) => setNecessiteSuivi(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, color: "var(--fg)" }}>
                  <strong>Nécessite un suivi ultérieur</strong>
                  <br />
                  <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                    Cochez si une autre intervention est à programmer (ex : suivi de prise, contrôle visuel à 1 mois).
                  </span>
                </span>
              </label>

              {necessiteSuivi && (
                <Field label="Notes pour le suivi">
                  <textarea
                    className="civiq-input civiq-textarea"
                    rows={2}
                    value={notesSuivi}
                    onChange={(e) => setNotesSuivi(e.target.value)}
                    placeholder="Ce qui devra être vérifié, quand, par qui…"
                  />
                </Field>
              )}
            </div>
          </>
        )}

        {/* ─── STEP 3 : Validation ─── */}
        {step === 3 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>
              <CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--success)" }} />
              Récapitulatif
            </h2>

            <div style={{ display: "grid", gap: 14 }}>
              <Recap label="Photos service fait">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <ImageIcon size={13} /> {photoPaths.length} photo{photoPaths.length > 1 ? "s" : ""} jointe{photoPaths.length > 1 ? "s" : ""}
                </span>
              </Recap>
              {description && <Recap label="Description">{description}</Recap>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {duree && <Recap label="Durée">{duree} min</Recap>}
                {cout && <Recap label="Coût">{Number(cout).toLocaleString("fr-FR")} €</Recap>}
              </div>
              {materiaux && <Recap label="Matériaux">{materiaux}</Recap>}
              {necessiteSuivi && (
                <Recap label="Suivi à prévoir">
                  {notesSuivi || <em style={{ color: "var(--fg-muted)" }}>(sans précision)</em>}
                </Recap>
              )}
            </div>

            <div style={{ marginTop: 18, padding: 14, background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)" }}>
              <p style={{ fontSize: 13, color: "var(--fg)", marginBottom: 10, lineHeight: 1.5 }}>
                <strong>Quel est le statut final ?</strong>
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => submit("resolu")}
                  disabled={pending}
                  className="civiq-btn civiq-btn-outline"
                  style={{ justifyContent: "flex-start", padding: "10px 14px" }}
                >
                  {pending ? <Loader2 size={14} className="civiq-spin" /> : <CheckCircle2 size={14} />}
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <strong>Marquer résolu</strong>
                    <br />
                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>L&apos;admin pourra clôturer après validation</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => submit("clos")}
                  disabled={pending}
                  className="civiq-btn civiq-btn-default"
                  style={{ justifyContent: "flex-start", padding: "10px 14px" }}
                >
                  {pending ? <Loader2 size={14} className="civiq-spin" /> : <CheckCircle2 size={14} />}
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <strong>Clôturer définitivement</strong>
                    <br />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Le ticket est terminé</span>
                  </span>
                </button>
              </div>
            </div>
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

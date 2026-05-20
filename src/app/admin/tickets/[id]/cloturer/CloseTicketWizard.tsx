"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, CheckCircle2, AlertCircle, Ban, CalendarClock, Check } from "lucide-react";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { closeTicketWithReport } from "@/lib/tickets/mutations";
import {
  TKHeader,
  TKStepBar,
  TKCtaBar,
  TKButton,
  TKInput,
} from "@/components/tickets/ui/tk-primitives";
import { TK } from "@/lib/tickets/design-tokens";
import type { TicketRapport } from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// CloseTicketWizard — version Airbnb mobile 3 étapes.
//   1 · Pièce jointe (photo / document / sans pièce)
//   2 · Suivi nécessaire ? (case + date + notes)
//   3 · Récapitulatif + clôture
// ═══════════════════════════════════════════════════════════════

interface Props {
  ticketId: string;
  ticketNumero: number;
  ticketTitre: string;
  communeId: string;
  existingRapport?: TicketRapport;
}

type AttachmentMode = "photo" | "document" | "none";

const TOTAL = 3;

export default function CloseTicketWizard({
  ticketId,
  ticketNumero,
  ticketTitre,
  communeId,
  existingRapport,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState<string | null>(null);

  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>("photo");
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [documentPaths, setDocumentPaths] = useState<string[]>([]);
  const [justification, setJustification] = useState("");

  const [necessiteSuivi, setNecessiteSuivi] = useState(
    existingRapport?.necessite_suivi ?? false,
  );
  const [reopenDate, setReopenDate] = useState<string>("");
  const [notesSuivi, setNotesSuivi] = useState(existingRapport?.notes_suivi ?? "");

  const [description, setDescription] = useState(
    existingRapport?.description_intervention ?? "",
  );

  function next() {
    setError(null);
    if (step === 0) {
      if (attachmentMode === "photo" && photoPaths.length === 0) {
        setError("Ajoutez au moins une photo, ou choisissez une autre option.");
        return;
      }
      if (attachmentMode === "document" && documentPaths.length === 0) {
        setError("Ajoutez au moins un document, ou choisissez une autre option.");
        return;
      }
      if (attachmentMode === "none" && justification.trim().length < 5) {
        setError("Justifiez (au moins 5 caractères) pourquoi aucune pièce.");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (necessiteSuivi && !reopenDate) {
        setError("Choisissez une date de réouverture pour le suivi.");
        return;
      }
      if (necessiteSuivi && reopenDate) {
        const d = new Date(reopenDate);
        if (d.getTime() <= Date.now()) {
          setError("La date de réouverture doit être dans le futur.");
          return;
        }
      }
      setStep(2);
    } else {
      submit("clos");
    }
  }

  function prev() {
    setError(null);
    if (step === 0) {
      router.push(`/admin/tickets/${ticketId}`);
      return;
    }
    setStep((s) => (s - 1) as 0 | 1 | 2);
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
          description_intervention:
            attachmentMode === "none"
              ? justification.trim() + (description ? "\n\n" + description : "")
              : description || null,
          necessite_suivi: necessiteSuivi,
          notes_suivi: necessiteSuivi ? notesSuivi : null,
          reopen_at:
            necessiteSuivi && reopenDate
              ? new Date(reopenDate).toISOString()
              : null,
          finalStatut,
        });
        router.push(
          `/admin/tickets/succes?id=${ticketId}&kind=closed`,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-white">
      <TKHeader
        onClose={() => router.push(`/admin/tickets/${ticketId}`)}
        title={`Clôture · #${ticketNumero}`}
      />
      <TKStepBar current={step} total={TOTAL} />

      {/* Pill de contexte */}
      <div className="px-[22px] pb-2">
        <div
          className="inline-flex max-w-full items-center gap-2 truncate rounded-full px-3 py-1.5 text-[12px]"
          style={{ background: TK.bg2, color: TK.ink2 }}
        >
          <CheckCircle2 size={12} style={{ color: TK.success }} />
          <span className="truncate">{ticketTitre}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pb-6 pt-2">
        {error && (
          <div
            className="mb-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px]"
            style={{
              background: "oklch(0.97 0.04 25)",
              color: TK.rouge,
              border: `1px solid ${TK.rouge}`,
            }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === 0 && (
          <StepAttachment
            mode={attachmentMode}
            onMode={setAttachmentMode}
            communeId={communeId}
            photoPaths={photoPaths}
            onPhotos={setPhotoPaths}
            documentPaths={documentPaths}
            onDocuments={setDocumentPaths}
            justification={justification}
            onJustification={setJustification}
            description={description}
            onDescription={setDescription}
          />
        )}

        {step === 1 && (
          <StepFollowup
            necessiteSuivi={necessiteSuivi}
            onNecessiteSuivi={setNecessiteSuivi}
            reopenDate={reopenDate}
            onReopenDate={setReopenDate}
            notesSuivi={notesSuivi}
            onNotesSuivi={setNotesSuivi}
            tomorrow={tomorrow}
          />
        )}

        {step === 2 && (
          <StepRecap
            ticketNumero={ticketNumero}
            ticketTitre={ticketTitre}
            attachmentMode={attachmentMode}
            photoCount={photoPaths.length}
            documentCount={documentPaths.length}
            description={description}
            necessiteSuivi={necessiteSuivi}
            reopenDate={reopenDate}
          />
        )}
      </div>

      <TKCtaBar mode="fixed">
        <div className="flex gap-2.5">
          <TKButton
            variant="secondary"
            onClick={prev}
            fullWidth={false}
            style={{ flex: "0 0 120px" }}
            disabled={pending}
          >
            {step === 0 ? "Annuler" : "Précédent"}
          </TKButton>
          <TKButton
            variant={step === TOTAL - 1 ? "marine" : "primary"}
            onClick={next}
            disabled={pending}
            fullWidth={false}
            style={{ flex: 1 }}
          >
            {step === TOTAL - 1
              ? pending
                ? "Clôture…"
                : "Clôturer le ticket"
              : "Continuer"}
          </TKButton>
        </div>
      </TKCtaBar>
    </main>
  );
}

// ─── STEPS ───────────────────────────────────────────────────────

function StepTitle({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="tk-fade">
      <div
        className="mt-1.5 text-[11px] font-bold uppercase"
        style={{ color: TK.muted, letterSpacing: "0.12em" }}
      >
        {eyebrow}
      </div>
      <h1
        className="m-0 mb-1.5 mt-2 font-bold leading-tight"
        style={{ fontSize: 26, color: TK.ink, letterSpacing: "-0.025em" }}
      >
        {title}
      </h1>
      {sub && (
        <p className="m-0 text-sm leading-snug" style={{ color: TK.muted }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  sub,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-2xl px-4 py-4 text-left"
      style={{
        border: `1.5px solid ${active ? TK.ink : TK.line}`,
        background: active ? "#FAFAFA" : "white",
        boxShadow: active ? `inset 0 0 0 1px ${TK.ink}` : "none",
      }}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-xl text-[20px]"
        style={{ width: 44, height: 44, background: TK.bg2, color: TK.ink }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span
          className="block text-[15px] font-semibold"
          style={{ color: TK.ink }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-[12px]"
          style={{ color: TK.muted }}
        >
          {sub}
        </span>
      </span>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 22,
          height: 22,
          border: `2px solid ${active ? TK.ink : TK.line}`,
          background: active ? TK.ink : "white",
          color: "white",
        }}
      >
        {active && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
}

function StepAttachment({
  mode,
  onMode,
  communeId,
  photoPaths,
  onPhotos,
  documentPaths: _documentPaths,
  onDocuments: _onDocuments,
  justification,
  onJustification,
  description,
  onDescription,
}: {
  mode: AttachmentMode;
  onMode: (m: AttachmentMode) => void;
  communeId: string;
  photoPaths: string[];
  onPhotos: (p: string[]) => void;
  documentPaths: string[];
  onDocuments: (p: string[]) => void;
  justification: string;
  onJustification: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 1"
        title="Preuve d'intervention"
        sub="Joins une photo, un document, ou justifie l'absence de pièce."
      />
      <div className="mt-6 flex flex-col gap-2.5">
        <ModeCard
          active={mode === "photo"}
          icon={<Camera size={20} />}
          title="Ajouter une photo"
          sub="Recommandé — photo « service fait »"
          onClick={() => onMode("photo")}
        />
        <ModeCard
          active={mode === "document"}
          icon={<FileText size={20} />}
          title="Ajouter un document"
          sub="Facture, devis, PDF"
          onClick={() => onMode("document")}
        />
        <ModeCard
          active={mode === "none"}
          icon={<Ban size={20} />}
          title="Sans pièce — justifier"
          sub="Justification écrite uniquement"
          onClick={() => onMode("none")}
        />
      </div>

      {mode === "photo" && (
        <div className="mt-5">
          <TicketPhotoUpload
            communeId={communeId}
            onChange={onPhotos}
            max={5}
            type="service_fait"
          />
          {photoPaths.length > 0 && (
            <p className="mt-2 text-[12px]" style={{ color: TK.muted }}>
              {photoPaths.length} photo(s) prête(s) à enregistrer.
            </p>
          )}
        </div>
      )}

      {mode === "document" && (
        <div
          className="mt-5 rounded-2xl px-4 py-3.5 text-[13px]"
          style={{ background: TK.bg2, color: TK.ink2 }}
        >
          L&apos;upload de documents arrive bientôt. Pour l&apos;instant, choisis
          « photo » ou décris l&apos;intervention dans la zone ci-dessous.
        </div>
      )}

      {mode === "none" && (
        <div className="mt-5">
          <TKInput
            label="Justification (obligatoire, min. 5 caractères)"
            value={justification}
            onChange={onJustification}
            placeholder="Ex. Intervention orale, sans support visuel."
            multiline
          />
        </div>
      )}

      <div className="mt-5">
        <TKInput
          label="Description de l'intervention (optionnel)"
          value={description}
          onChange={onDescription}
          placeholder="Détaille ce qui a été fait, par qui, et le résultat."
          multiline
        />
      </div>
    </>
  );
}

function StepFollowup({
  necessiteSuivi,
  onNecessiteSuivi,
  reopenDate,
  onReopenDate,
  notesSuivi,
  onNotesSuivi,
  tomorrow,
}: {
  necessiteSuivi: boolean;
  onNecessiteSuivi: (v: boolean) => void;
  reopenDate: string;
  onReopenDate: (v: string) => void;
  notesSuivi: string;
  onNotesSuivi: (v: string) => void;
  tomorrow: string;
}) {
  function quickPick(days: number) {
    const d = new Date(Date.now() + days * 86_400_000);
    onReopenDate(d.toISOString().slice(0, 10));
  }
  return (
    <>
      <StepTitle
        eyebrow="Étape 2"
        title="Un suivi est-il nécessaire ?"
        sub="Programme une réouverture automatique du ticket."
      />
      <div className="mt-6 flex flex-col gap-2.5">
        <ModeCard
          active={!necessiteSuivi}
          icon={<CheckCircle2 size={20} />}
          title="Pas de suivi nécessaire"
          sub="Le ticket sera clos définitivement"
          onClick={() => onNecessiteSuivi(false)}
        />
        <ModeCard
          active={necessiteSuivi}
          icon={<CalendarClock size={20} />}
          title="Programmer un suivi"
          sub="Le ticket sera rouvert à la date choisie"
          onClick={() => onNecessiteSuivi(true)}
        />
      </div>

      {necessiteSuivi && (
        <div className="mt-5 flex flex-col gap-3.5">
          <div>
            <div
              className="mb-2 text-[12px] font-semibold"
              style={{ color: TK.ink2 }}
            >
              Date de réouverture
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { label: "1 sem.", days: 7 },
                { label: "15 j", days: 15 },
                { label: "1 mois", days: 30 },
                { label: "3 mois", days: 90 },
              ].map((q) => (
                <button
                  key={q.days}
                  type="button"
                  onClick={() => quickPick(q.days)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    background: TK.bg2,
                    color: TK.ink,
                    border: `1px solid ${TK.line}`,
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={reopenDate}
              onChange={(e) => onReopenDate(e.target.value)}
              min={tomorrow}
              className="w-full rounded-xl bg-white px-4 py-[14px] text-[15px] outline-none"
              style={{
                border: `1.5px solid ${TK.line}`,
                color: TK.ink,
              }}
            />
          </div>
          <TKInput
            label="Note pour le suivi (optionnel)"
            value={notesSuivi}
            onChange={onNotesSuivi}
            placeholder="Ex. Revérifier l'éclairage après la pluie."
            multiline
          />
        </div>
      )}
    </>
  );
}

function StepRecap({
  ticketNumero,
  ticketTitre,
  attachmentMode,
  photoCount,
  documentCount,
  description,
  necessiteSuivi,
  reopenDate,
}: {
  ticketNumero: number;
  ticketTitre: string;
  attachmentMode: AttachmentMode;
  photoCount: number;
  documentCount: number;
  description: string;
  necessiteSuivi: boolean;
  reopenDate: string;
}) {
  const rows: Array<{ k: string; v: string }> = [
    { k: "Ticket", v: `#${ticketNumero} — ${ticketTitre}` },
    {
      k: "Pièce jointe",
      v:
        attachmentMode === "photo"
          ? `${photoCount} photo(s)`
          : attachmentMode === "document"
            ? `${documentCount} document(s)`
            : "Sans pièce",
    },
    {
      k: "Description",
      v: description.trim() ? description.slice(0, 80) + (description.length > 80 ? "…" : "") : "—",
    },
    {
      k: "Suivi",
      v: necessiteSuivi
        ? `Réouverture le ${new Date(reopenDate).toLocaleDateString("fr-FR")}`
        : "Non",
    },
    {
      k: "Date",
      v: new Date().toLocaleDateString("fr-FR"),
    },
  ];
  return (
    <>
      <StepTitle
        eyebrow="Étape 3"
        title="Récapitulatif"
        sub="Vérifie avant de clôturer définitivement."
      />
      <div
        className="mt-6 overflow-hidden rounded-2xl"
        style={{ border: `1.5px solid ${TK.line}` }}
      >
        {rows.map((r, i) => (
          <div
            key={r.k}
            className="flex items-start justify-between gap-4 px-4 py-3"
            style={{
              borderTop: i === 0 ? "none" : `1px solid ${TK.line}`,
              background: i % 2 === 0 ? "white" : TK.bg2,
            }}
          >
            <span className="text-[12px] font-semibold" style={{ color: TK.muted }}>
              {r.k}
            </span>
            <span
              className="text-right text-[13px] font-semibold"
              style={{ color: TK.ink }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

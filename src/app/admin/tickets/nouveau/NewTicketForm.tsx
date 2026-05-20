"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import TicketLocationPicker, {
  type LocationValue,
} from "@/components/tickets/TicketLocationPicker";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { createTicket } from "@/lib/tickets/mutations";
import {
  TKHeader,
  TKStepBar,
  TKCtaBar,
  TKButton,
  TKInput,
  TKAvatar,
} from "@/components/tickets/ui/tk-primitives";
import {
  TK,
  TK_CATEGORIES,
  TK_PRIORITES,
  TK_CANAUX,
} from "@/lib/tickets/design-tokens";
import type {
  TicketCanal,
  TicketCategorie,
  TicketPriorite,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Wizard de création — 6 étapes, une question par écran (Airbnb).
// CTA fixe en bas, step bar segmentée en haut.
//   1 Canal · 2 Catégorie · 3 Description+Priorité ·
//   4 Localisation · 5 Photos · 6 Assignation
// ═══════════════════════════════════════════════════════════════

interface Props {
  communeId: string;
  agents: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
}

const TOTAL_STEPS = 6;

const CANAL_ICONS: Record<TicketCanal, string> = {
  elu_terrain: "🚶",
  agent_interne: "🛠️",
  telephone: "📞",
  email: "✉️",
};

const CATEGORIES: TicketCategorie[] = [
  "voirie",
  "eclairage_public",
  "proprete",
  "espaces_verts",
  "batiment",
  "mobilier_urbain",
  "reseaux_eau",
  "signalisation",
  "autre",
];

export default function NewTicketForm({ communeId, agents }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // State formulaire
  const [canal, setCanal] = useState<TicketCanal>("elu_terrain");
  const [categorie, setCategorie] = useState<TicketCategorie | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState<TicketPriorite>("normale");
  const [location, setLocation] = useState<LocationValue>({
    latitude: null,
    longitude: null,
    adresse: null,
    precision_geo: null,
  });
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [assigneIds, setAssigneIds] = useState<string[]>([]);
  // Demandeur (canaux externes)
  const [demandeurNom, setDemandeurNom] = useState("");
  const [demandeurTel, setDemandeurTel] = useState("");
  const [demandeurEmail, setDemandeurEmail] = useState("");

  const showDemandeur = canal === "telephone" || canal === "email";

  function toggleAssignee(id: string) {
    setAssigneIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function canNext(): boolean {
    if (step === 0) return !!canal;
    if (step === 1) return !!categorie;
    if (step === 2) return titre.trim().length > 2;
    if (step === 3) return !!location.adresse?.trim() || !!location.latitude;
    if (step === 4) return true;
    if (step === 5) return true;
    return true;
  }

  function next() {
    setError(null);
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      return;
    }
    submit();
  }

  function prev() {
    setError(null);
    if (step === 0) {
      router.push("/admin/tickets");
      return;
    }
    setStep(step - 1);
  }

  function submit() {
    if (!titre.trim() || !categorie) {
      setError("Informations incomplètes.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createTicket({
          canal,
          demandeur_nom: showDemandeur ? demandeurNom : null,
          demandeur_telephone: showDemandeur ? demandeurTel : null,
          demandeur_email: showDemandeur ? demandeurEmail : null,
          titre,
          description,
          categorie,
          priorite,
          adresse: location.adresse,
          latitude: location.latitude,
          longitude: location.longitude,
          precision_geo: location.precision_geo,
          assignee_ids: assigneIds,
          photo_paths: photoPaths,
        });
        router.push(`/admin/tickets/succes?id=${result.id}&kind=created`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    });
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-white">
      <TKHeader
        onClose={() => router.push("/admin/tickets")}
        title={`Étape ${step + 1} sur ${TOTAL_STEPS}`}
      />
      <TKStepBar current={step} total={TOTAL_STEPS} />

      <div className="flex-1 overflow-y-auto px-[22px] pb-6 pt-1">
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
          <Step1Canal value={canal} onChange={setCanal} />
        )}

        {step === 0 && showDemandeur && (
          <div className="mt-6">
            <StepTitleSub label="Demandeur" />
            <div className="mt-3 flex flex-col gap-3">
              <TKInput
                label="Nom"
                value={demandeurNom}
                onChange={setDemandeurNom}
                placeholder="Mme Dupont"
              />
              <TKInput
                label="Téléphone"
                value={demandeurTel}
                onChange={setDemandeurTel}
                placeholder="06 12 34 56 78"
              />
              <TKInput
                label="Email"
                value={demandeurEmail}
                onChange={setDemandeurEmail}
                placeholder="dupont@example.fr"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <Step2Categorie value={categorie} onChange={setCategorie} />
        )}

        {step === 2 && (
          <Step3Description
            titre={titre}
            description={description}
            priorite={priorite}
            onTitre={setTitre}
            onDescription={setDescription}
            onPriorite={setPriorite}
          />
        )}

        {step === 3 && (
          <Step4Localisation value={location} onChange={setLocation} />
        )}

        {step === 4 && (
          <Step5Photos
            communeId={communeId}
            paths={photoPaths}
            onChange={setPhotoPaths}
          />
        )}

        {step === 5 && (
          <Step6Assignation
            agents={agents}
            selected={assigneIds}
            onToggle={toggleAssignee}
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
          >
            {step === 0 ? "Annuler" : "Précédent"}
          </TKButton>
          <TKButton
            variant="primary"
            onClick={next}
            disabled={!canNext() || pending}
            fullWidth={false}
            style={{ flex: 1 }}
          >
            {step === TOTAL_STEPS - 1
              ? pending
                ? "Création…"
                : "Créer le ticket"
              : "Continuer"}
          </TKButton>
        </div>
      </TKCtaBar>
    </main>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

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
        style={{
          fontSize: 26,
          color: TK.ink,
          letterSpacing: "-0.025em",
        }}
      >
        {title}
      </h1>
      {sub && (
        <p
          className="m-0 text-sm leading-snug"
          style={{ color: TK.muted }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function StepTitleSub({ label }: { label: string }) {
  return (
    <span
      className="text-[11px] font-bold uppercase"
      style={{ color: TK.muted, letterSpacing: "0.12em" }}
    >
      {label}
    </span>
  );
}

function BigOption({
  selected,
  onClick,
  icon,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3.5 rounded-2xl px-4 py-4 text-left transition-all"
      style={{
        border: `1.5px solid ${selected ? TK.ink : TK.line}`,
        background: selected ? "#FAFAFA" : "white",
        boxShadow: selected ? `inset 0 0 0 1px ${TK.ink}` : "none",
      }}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-xl text-[22px]"
        style={{ width: 44, height: 44, background: TK.bg2 }}
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
        {sub && (
          <span
            className="mt-0.5 block text-[12px]"
            style={{ color: TK.muted }}
          >
            {sub}
          </span>
        )}
      </span>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
        style={{
          width: 22,
          height: 22,
          border: `2px solid ${selected ? TK.ink : TK.line}`,
          background: selected ? TK.ink : "white",
          fontSize: 12,
        }}
      >
        {selected ? <Check size={12} strokeWidth={3} /> : ""}
      </span>
    </button>
  );
}

// ─── STEPS ───────────────────────────────────────────────────────

function Step1Canal({
  value,
  onChange,
}: {
  value: TicketCanal;
  onChange: (v: TicketCanal) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 1"
        title="Comment ce ticket est-il signalé ?"
        sub="Le canal d'entrée du signalement."
      />
      <div className="mt-6 flex flex-col gap-2.5">
        {(Object.entries(TK_CANAUX) as Array<
          [TicketCanal, { label: string; sub: string }]
        >).map(([id, cfg]) => (
          <BigOption
            key={id}
            selected={value === id}
            onClick={() => onChange(id)}
            icon={CANAL_ICONS[id]}
            title={cfg.label}
            sub={cfg.sub}
          />
        ))}
      </div>
    </>
  );
}

function Step2Categorie({
  value,
  onChange,
}: {
  value: TicketCategorie | null;
  onChange: (v: TicketCategorie) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 2"
        title="De quoi s'agit-il ?"
        sub="Choisis la catégorie qui correspond le mieux."
      />
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {CATEGORIES.map((c) => {
          const cfg = TK_CATEGORIES[c];
          const selected = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className="flex flex-col items-start gap-2 rounded-2xl px-3 py-3.5 text-left transition-all"
              style={{
                border: `1.5px solid ${selected ? TK.ink : TK.line}`,
                background: selected ? "#FAFAFA" : "white",
                boxShadow: selected ? `inset 0 0 0 1px ${TK.ink}` : "none",
              }}
            >
              <span
                className="inline-flex items-center justify-center rounded-[10px] text-lg"
                style={{
                  width: 36,
                  height: 36,
                  background: cfg.color + "18",
                  color: cfg.color,
                }}
              >
                {cfg.icon}
              </span>
              <span
                className="text-[13px] font-semibold"
                style={{ color: TK.ink }}
              >
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Step3Description({
  titre,
  description,
  priorite,
  onTitre,
  onDescription,
  onPriorite,
}: {
  titre: string;
  description: string;
  priorite: TicketPriorite;
  onTitre: (v: string) => void;
  onDescription: (v: string) => void;
  onPriorite: (v: TicketPriorite) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 3"
        title="Décris le problème"
        sub="Un titre court + quelques détails. Tu pourras compléter plus tard."
      />
      <div className="mt-6 flex flex-col gap-[18px]">
        <TKInput
          label="Titre"
          value={titre}
          onChange={onTitre}
          placeholder="Ex. Nid-de-poule rue de la Mairie"
          autoFocus
          maxLength={80}
          hint={`${titre.length} / 80 caractères`}
        />
        <TKInput
          label="Description (optionnel)"
          value={description}
          onChange={onDescription}
          placeholder="Détaille la nature, la taille, le danger éventuel…"
          multiline
        />
        <div>
          <span
            className="mb-2.5 block text-[12px] font-semibold"
            style={{ color: TK.ink2 }}
          >
            Priorité
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(TK_PRIORITES) as Array<
              [TicketPriorite, { label: string; color: string; hint: string }]
            >).map(([id, cfg]) => {
              const selected = priorite === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPriorite(id)}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
                  style={{
                    border: `1.5px solid ${selected ? TK.ink : TK.line}`,
                    background: selected ? "#FAFAFA" : "white",
                    boxShadow: selected ? `inset 0 0 0 1px ${TK.ink}` : "none",
                  }}
                >
                  <span
                    className="rounded"
                    style={{
                      width: 12,
                      height: 12,
                      background: cfg.color,
                    }}
                  />
                  <span className="flex-1">
                    <span
                      className="block text-[13px] font-bold"
                      style={{ color: TK.ink }}
                    >
                      {cfg.label}
                    </span>
                    <span
                      className="mt-px block text-[10px]"
                      style={{ color: TK.muted }}
                    >
                      {cfg.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function Step4Localisation({
  value,
  onChange,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 4"
        title="Où exactement ?"
        sub="GPS, adresse libre ou clic sur la carte."
      />
      <div className="mt-6">
        <TicketLocationPicker value={value} onChange={onChange} />
      </div>
    </>
  );
}

function Step5Photos({
  communeId,
  onChange,
}: {
  communeId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape 5"
        title="Ajoute des photos"
        sub="Jusqu'à 5 photos. C'est optionnel mais très utile pour les agents."
      />
      <div className="mt-6">
        <TicketPhotoUpload communeId={communeId} onChange={onChange} max={5} />
      </div>
    </>
  );
}

function Step6Assignation({
  agents,
  selected,
  onToggle,
}: {
  agents: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <StepTitle
        eyebrow="Étape finale"
        title="Assigner (optionnel)"
        sub="Tu peux confier ce ticket à un·e collègue maintenant ou plus tard."
      />
      <div className="mt-6 flex flex-col gap-1.5">
        {agents.length === 0 && (
          <p className="text-[13px]" style={{ color: TK.muted }}>
            Aucun agent disponible.
          </p>
        )}
        {agents.map((a) => {
          const checked = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              className="flex items-center gap-3 rounded-xl px-1 py-3"
            >
              <TKAvatar name={a.full_name} seed={a.id} size={42} />
              <div className="flex-1 text-left">
                <div
                  className="text-sm font-semibold"
                  style={{ color: TK.ink }}
                >
                  {a.full_name || "(sans nom)"}
                </div>
                {a.job_title && (
                  <div
                    className="text-[11px] capitalize"
                    style={{ color: TK.muted }}
                  >
                    {a.job_title.replace("_", " ")}
                  </div>
                )}
              </div>
              <span
                className="inline-flex items-center justify-center rounded-[7px]"
                style={{
                  width: 24,
                  height: 24,
                  border: `2px solid ${checked ? TK.ink : TK.line}`,
                  background: checked ? TK.ink : "white",
                  color: "white",
                }}
              >
                {checked && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

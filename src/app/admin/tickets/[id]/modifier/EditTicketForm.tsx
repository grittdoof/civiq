"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Save,
} from "lucide-react";
import TicketLocationPicker from "@/components/tickets/TicketLocationPicker";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { updateTicket } from "@/lib/tickets/mutations";
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
  type WizardValue,
} from "@/lib/tickets/useTicketWizard";

// ═══════════════════════════════════════════════════════════════
// EditTicketForm — édition d'un ticket existant.
//
// Réutilise useTicketWizard pour partager la même source de vérité
// que la création, mais affiche toutes les sections d'un coup (pas de
// wizard pas-à-pas) — l'utilisateur édite typiquement un champ précis,
// pas tout le ticket.
//
// Chaque modification est journalisée côté serveur via updateTicket().
// ═══════════════════════════════════════════════════════════════

interface TicketSeed {
  id: string;
  numero: number;
  canal: TicketCanal;
  titre: string;
  description: string | null;
  categorie: TicketCategorie;
  priorite: TicketPriorite;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  precision_geo: string | null;
  demandeur_nom: string | null;
  demandeur_telephone: string | null;
  demandeur_email: string | null;
  demandeur_adresse: string | null;
  echeance: string | null;
}

interface Agent {
  id: string;
  full_name: string | null;
  job_title: string | null;
}

interface Props {
  communeId: string;
  agents: Agent[];
  ticket: TicketSeed;
  initialAssigneeIds: string[];
}

const CANAUX: Array<{ value: TicketCanal; emoji: string; help: string }> = [
  { value: "elu_terrain", emoji: "🏃", help: "Signalement depuis le terrain" },
  { value: "agent_interne", emoji: "🏛️", help: "Service municipal" },
  { value: "telephone", emoji: "📞", help: "Appel d'un habitant" },
  { value: "email", emoji: "✉️", help: "Email reçu" },
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

export default function EditTicketForm({
  communeId, agents, ticket, initialAssigneeIds,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const wiz = useTicketWizard({
    canal: ticket.canal,
    titre: ticket.titre,
    description: ticket.description ?? "",
    categorie: ticket.categorie,
    priorite: ticket.priorite,
    location: {
      adresse: ticket.adresse,
      latitude: ticket.latitude,
      longitude: ticket.longitude,
      // precision_geo est un enum DB ('adresse'|'gps'|'manuelle')
      precision_geo: ticket.precision_geo as "adresse" | "gps" | "manuelle" | null,
    },
    demandeur_nom: ticket.demandeur_nom ?? "",
    demandeur_telephone: ticket.demandeur_telephone ?? "",
    demandeur_email: ticket.demandeur_email ?? "",
    demandeur_adresse: ticket.demandeur_adresse ?? "",
    echeance: ticket.echeance ?? "",
    assigneIds: initialAssigneeIds,
    photoPaths: [],
  });
  const { value, set } = wiz;
  const [newPhotoPaths, setNewPhotoPaths] = useState<string[]>([]);

  // Prévient la sortie si saisie non sauvegardée
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

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
    if (!value.titre.trim() || !value.categorie) {
      setError("Le titre et la catégorie sont requis.");
      return;
    }
    const showDemandeur = value.canal === "telephone" || value.canal === "email";

    startTransition(async () => {
      try {
        await updateTicket({
          ticketId: ticket.id,
          canal: value.canal,
          titre: value.titre,
          description: value.description,
          categorie: value.categorie!,
          priorite: value.priorite,
          adresse: value.location.adresse,
          latitude: value.location.latitude,
          longitude: value.location.longitude,
          precision_geo: value.location.precision_geo,
          demandeur_nom: showDemandeur ? value.demandeur_nom : null,
          demandeur_telephone: showDemandeur ? value.demandeur_telephone : null,
          demandeur_email: showDemandeur ? value.demandeur_email : null,
          demandeur_adresse: showDemandeur ? value.demandeur_adresse : null,
          echeance: value.echeance || null,
          assignee_ids: value.assigneIds,
          new_photo_paths: newPhotoPaths,
        });
        router.push(`/admin/tickets/${ticket.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    });
  }

  const showDemandeur = value.canal === "telephone" || value.canal === "email";

  return (
    <main className="civiq-main tk-form-desktop tk-edit-form">
      <Link href={`/admin/tickets/${ticket.id}`} className="tk-form-desktop-back">
        <ArrowLeft size={14} /> Ticket #{ticket.numero}
      </Link>

      <header className="tk-form-desktop-header">
        <h1 className="civiq-page-title">Modifier le ticket</h1>
        <p className="tk-form-desktop-sub">
          Chaque modification est automatiquement enregistrée dans le journal
          d&apos;activité du ticket.
        </p>
      </header>

      {error && (
        <div className="tk-wizard-error tk-form-desktop-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="tk-form-desktop-sections">
        {/* Canal */}
        <Card num={1} eyebrow="Canal" title="Comment ce ticket est-il signalé ?">
          <div className="tk-options-grid-2">
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
        </Card>

        {/* Demandeur (si canal externe) */}
        {showDemandeur && (
          <Card num={2} eyebrow="Demandeur" title="Coordonnées du demandeur">
            <div className="tk-fields-grid-2">
              <Field label="Nom">
                <input className="civiq-input" value={value.demandeur_nom}
                  onChange={(e) => set("demandeur_nom", e.target.value)}
                  placeholder="Mme Dupont" autoComplete="name" />
              </Field>
              <Field label="Téléphone">
                <input className="civiq-input" type="tel" inputMode="tel"
                  value={value.demandeur_telephone}
                  onChange={(e) => set("demandeur_telephone", e.target.value)}
                  placeholder="06 12 34 56 78" autoComplete="tel" />
              </Field>
              <Field label="Email">
                <input className="civiq-input" type="email" inputMode="email"
                  value={value.demandeur_email}
                  onChange={(e) => set("demandeur_email", e.target.value)}
                  placeholder="dupont@example.fr" autoComplete="email" />
              </Field>
              <Field label="Adresse">
                <input className="civiq-input"
                  value={value.demandeur_adresse}
                  onChange={(e) => set("demandeur_adresse", e.target.value)}
                  placeholder="12 rue X" autoComplete="street-address" />
              </Field>
            </div>
          </Card>
        )}

        {/* Catégorie */}
        <Card num={showDemandeur ? 3 : 2} eyebrow="Catégorie" title="De quoi s'agit-il ?">
          <div className="tk-cat-grid-desktop">
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
        </Card>

        {/* Description */}
        <Card num={showDemandeur ? 4 : 3} eyebrow="Description" title="Décris le problème">
          <div className="tk-desc-grid">
            <Field label="Titre court" required>
              <input
                className="civiq-input"
                value={value.titre}
                onChange={(e) => set("titre", e.target.value)}
                placeholder="Ex : Nid-de-poule rue de la Mairie"
                maxLength={200}
              />
              <span className="civiq-hint">{value.titre.length} / 200</span>
            </Field>
            <Field label="Description">
              <textarea
                className="civiq-input civiq-textarea"
                rows={5}
                value={value.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Détails utiles : gravité observée, accès, etc."
              />
            </Field>
          </div>
        </Card>

        {/* Priorité */}
        <Card num={showDemandeur ? 5 : 4} eyebrow="Priorité" title="À quel point est-ce urgent ?">
          <div className="tk-prio-grid-desktop">
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
        </Card>

        {/* Localisation */}
        <Card num={showDemandeur ? 6 : 5} eyebrow="Localisation" title="Où exactement ?">
          <TicketLocationPicker
            value={value.location}
            onChange={(loc) => set("location", loc)}
          />
        </Card>

        {/* Photos (ajout uniquement, pas de suppression v1) */}
        <Card num={showDemandeur ? 7 : 6} eyebrow="Photos" title="Ajouter des photos" optional>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 12 }}>
            Les photos déjà attachées au ticket restent visibles dans le détail.
            Tu peux en ajouter de nouvelles ci-dessous.
          </p>
          <TicketPhotoUpload
            communeId={communeId}
            onChange={setNewPhotoPaths}
            max={5}
          />
        </Card>

        {/* Assignation */}
        <Card num={showDemandeur ? 8 : 7} eyebrow="Assignation" title="Agents assignés" optional>
          <div className="tk-assign-grid">
            {agents.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Aucun agent disponible.</p>
            ) : (
              <div className="tk-agents-grid-desktop">
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
            <Field label="Échéance souhaitée">
              <input
                type="date"
                className="civiq-input"
                value={value.echeance}
                onChange={(e) => set("echeance", e.target.value)}
                style={{ maxWidth: 240 }}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="tk-form-desktop-submit">
        <Link href={`/admin/tickets/${ticket.id}`} className="civiq-btn civiq-btn-ghost">
          Annuler
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="civiq-btn civiq-btn-default"
        >
          {pending ? <Loader2 size={16} className="civiq-spin" /> : <Save size={16} />}
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </main>
  );
}

// ─── Petits helpers (locaux) ────────────────────────────────────

function Card({
  num, eyebrow, title, optional, children,
}: {
  num: number;
  eyebrow: string;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="civiq-card tk-form-desktop-card">
      <div className="tk-form-desktop-card-head">
        <span className="tk-form-desktop-num">{num}</span>
        <div>
          <div className="tk-form-desktop-eyebrow">
            {eyebrow}
            {optional && <span className="tk-form-desktop-optional"> · optionnel</span>}
          </div>
          <h2 className="tk-form-desktop-title">{title}</h2>
        </div>
      </div>
      <div className="tk-form-desktop-card-body">{children}</div>
    </section>
  );
}

function Field({
  label, required, children,
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

// Type juste pour rappeler que value est de type WizardValue (lint)
export type { WizardValue };

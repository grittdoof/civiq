"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import TicketLocationPicker, { type LocationValue } from "@/components/tickets/TicketLocationPicker";
import TicketPhotoUpload from "@/components/tickets/TicketPhotoUpload";
import { createTicket } from "@/lib/tickets/mutations";
import {
  CANAL_LABELS, CATEGORIE_LABELS, CATEGORIE_ICONS, PRIORITE_LABELS, PRIORITE_COLORS,
  type TicketCanal, type TicketCategorie, type TicketPriorite,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// Formulaire complet de création (client) — sections progressives
//
//   1. Canal de réception
//   2. Demandeur (si canal externe)
//   3. Description (titre, description, catégorie, priorité)
//   4. Localisation
//   5. Photos
//   6. Assignation (optionnelle)
//
// Conçu pour être rempli en < 1 min sur mobile par un élu terrain.
// ═══════════════════════════════════════════════════════════════

interface Props {
  communeId: string;
  agents: Array<{ id: string; full_name: string | null; job_title: string | null }>;
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

export default function NewTicketForm({ communeId, agents }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [canal, setCanal] = useState<TicketCanal>("elu_terrain");
  const [demandeurNom, setDemandeurNom] = useState("");
  const [demandeurTel, setDemandeurTel] = useState("");
  const [demandeurEmail, setDemandeurEmail] = useState("");
  const [demandeurAdresse, setDemandeurAdresse] = useState("");

  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<TicketCategorie>("voirie");
  const [priorite, setPriorite] = useState<TicketPriorite>("normale");

  const [location, setLocation] = useState<LocationValue>({
    latitude: null, longitude: null, adresse: null, precision_geo: null,
  });

  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [assigneA, setAssigneA] = useState<string>("");
  const [echeance, setEcheance] = useState<string>("");

  const showDemandeur = canal !== "elu_terrain" && canal !== "agent_interne";

  function submit() {
    setError(null);
    if (!titre.trim()) {
      setError("Le titre du ticket est requis.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createTicket({
          canal,
          demandeur_nom: showDemandeur ? demandeurNom : null,
          demandeur_telephone: showDemandeur ? demandeurTel : null,
          demandeur_email: showDemandeur ? demandeurEmail : null,
          demandeur_adresse: showDemandeur ? demandeurAdresse : null,
          titre,
          description,
          categorie,
          priorite,
          adresse: location.adresse,
          latitude: location.latitude,
          longitude: location.longitude,
          precision_geo: location.precision_geo,
          assigne_a: assigneA || null,
          echeance: echeance || null,
          photo_paths: photoPaths,
        });
        router.push(`/admin/tickets/${result.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      }
    });
  }

  return (
    <main className="civiq-main">
      <Link href="/admin/tickets" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={14} /> Tickets
      </Link>

      <header style={{ marginBottom: 20 }}>
        <h1 className="civiq-page-title">Nouveau ticket</h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 3 }}>
          Renseignez les informations de l&apos;intervention. Tous les champs avec * sont obligatoires.
        </p>
      </header>

      {error && (
        <div style={{ display: "flex", gap: 10, padding: "10px 14px", background: "oklch(0.97 0.04 25)", border: "1px solid var(--destructive)", color: "var(--destructive)", borderRadius: "var(--radius-sm)", fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 18, maxWidth: 720 }}>
        {/* ── 1. Canal ── */}
        <Section title="1 · Canal de réception" subtitle="Comment ce signalement est-il arrivé ?">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {CANAUX.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCanal(c.value)}
                className="tk-option-card"
                data-active={canal === c.value}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{CANAL_LABELS[c.value]}</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.35 }}>{c.help}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 2. Demandeur ── */}
        {showDemandeur && (
          <Section title="2 · Demandeur" subtitle="Qui a signalé ce problème ?">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <Field label="Nom">
                <input className="civiq-input" value={demandeurNom} onChange={(e) => setDemandeurNom(e.target.value)} placeholder="Mme Dupont" />
              </Field>
              <Field label="Téléphone">
                <input className="civiq-input" type="tel" value={demandeurTel} onChange={(e) => setDemandeurTel(e.target.value)} placeholder="06 12 34 56 78" />
              </Field>
              <Field label="Email">
                <input className="civiq-input" type="email" value={demandeurEmail} onChange={(e) => setDemandeurEmail(e.target.value)} placeholder="dupont@example.fr" />
              </Field>
              <Field label="Adresse">
                <input className="civiq-input" value={demandeurAdresse} onChange={(e) => setDemandeurAdresse(e.target.value)} placeholder="12 rue X" />
              </Field>
            </div>
          </Section>
        )}

        {/* ── 3. Description ── */}
        <Section title={`${showDemandeur ? "3" : "2"} · Description`} subtitle="Décrivez le problème en quelques mots clairs.">
          <Field label="Titre court *">
            <input
              className="civiq-input"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Nid-de-poule rue de la Mairie"
              maxLength={200}
              required
            />
          </Field>
          <Field label="Description (détails utiles)">
            <textarea
              className="civiq-input civiq-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Localisation précise, gravité observée, accès, etc."
            />
          </Field>

          <Field label="Catégorie *">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategorie(c)}
                  className="tk-pill"
                  data-active={categorie === c}
                  style={categorie === c ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : undefined}
                >
                  <span aria-hidden>{CATEGORIE_ICONS[c]}</span> {CATEGORIE_LABELS[c]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Priorité *">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {PRIORITES.map((p) => {
                const c = PRIORITE_COLORS[p.value];
                const active = priorite === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriorite(p.value)}
                    className="tk-option-card"
                    data-active={active}
                    style={active ? { borderColor: c.fg, background: c.bg } : undefined}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.fg, display: "inline-block" }} />
                      <strong style={{ color: "var(--fg)", fontSize: 13 }}>{PRIORITE_LABELS[p.value]}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.4 }}>{p.sub}</div>
                  </button>
                );
              })}
            </div>
          </Field>
        </Section>

        {/* ── 4. Localisation ── */}
        <Section title={`${showDemandeur ? "4" : "3"} · Localisation`} subtitle="GPS, adresse ou clic sur la carte — au choix.">
          <TicketLocationPicker value={location} onChange={setLocation} />
        </Section>

        {/* ── 5. Photos ── */}
        <Section title={`${showDemandeur ? "5" : "4"} · Photos`} subtitle="Au moins une photo aide énormément l'agent technique.">
          <TicketPhotoUpload communeId={communeId} onChange={setPhotoPaths} max={5} />
        </Section>

        {/* ── 6. Assignation ── */}
        <Section title={`${showDemandeur ? "6" : "5"} · Assignation (optionnel)`} subtitle="Si vous savez déjà qui doit s'en occuper.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <Field label="Agent assigné">
              <select className="civiq-select" value={assigneA} onChange={(e) => setAssigneA(e.target.value)}>
                <option value="">— Non assigné —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || "(sans nom)"}
                    {a.job_title ? ` — ${a.job_title.replace("_", " ")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Échéance souhaitée">
              <input
                type="date"
                className="civiq-input"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>
          </div>
        </Section>

        {/* Footer actions */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          paddingTop: 12, marginTop: 4, borderTop: "1px solid var(--border)",
          position: "sticky", bottom: 0, background: "var(--bg)", paddingBottom: 12,
        }}>
          <Link href="/admin/tickets" className="civiq-btn civiq-btn-ghost">Annuler</Link>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !titre.trim()}
            className="civiq-btn civiq-btn-default"
            style={{ minWidth: 160, justifyContent: "center" }}
          >
            <Save size={14} /> {pending ? "Création…" : "Créer le ticket"}
          </button>
        </div>
      </div>

      <style>{`
        .tk-option-card {
          padding: 10px 12px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          transition: border-color var(--transition), background var(--transition);
        }
        .tk-option-card:hover { border-color: var(--fg-muted); }
        .tk-option-card[data-active="true"] {
          border-color: var(--accent);
          background: var(--accent-light);
        }
      `}</style>
    </main>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="civiq-card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>{subtitle}</p>}
      </div>
      {children}
    </section>
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

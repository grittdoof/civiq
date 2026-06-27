"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPlus, X, Mail, Phone, Building2 } from "lucide-react";
import {
  PROJECT_PHASES,
  PROJECT_PHASE_LABELS,
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  type ProjectPhase,
  type ProjectStakeholder,
  type Stakeholder,
  type StakeholderRole,
  type StakeholderType,
} from "@/lib/projects/types";

interface Props {
  projectId: string;
  initial: Array<ProjectStakeholder & { stakeholder: Stakeholder | null }>;
  /** Annuaire commune (récupéré par le parent) */
  directory: Stakeholder[];
}

const ROLES: StakeholderRole[] = ["decide", "finance", "execute", "consulte", "informe"];
const TYPES: StakeholderType[] = ["interne", "institutionnelle", "financeur", "technique", "citoyenne"];

export default function StakeholdersEditor({ projectId, initial, directory }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [dir, setDir] = useState(directory);
  const [contactOpen, setContactOpen] = useState<Stakeholder | null>(null);

  // Onglet : 1 = associer un existant ; 2 = créer un nouveau
  const [adding, setAdding] = useState<"none" | "existing" | "new">("none");
  const [existing, setExisting] = useState({
    stakeholder_id: "",
    role: "consulte" as StakeholderRole,
    phase: "" as ProjectPhase | "",
  });
  const [newSt, setNewSt] = useState({
    nom: "",
    organisation: "",
    email: "",
    telephone: "",
    type: "institutionnelle" as StakeholderType,
    role: "consulte" as StakeholderRole,
    phase: "" as ProjectPhase | "",
  });

  async function attach(stakeholder_id: string, role: StakeholderRole, phase: ProjectPhase | "") {
    const res = await fetch(`/api/projects/${projectId}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stakeholder_id, role, phase: phase || null }),
    });
    if (res.ok) {
      const { project_stakeholder } = (await res.json()) as {
        project_stakeholder: ProjectStakeholder & { stakeholder: Stakeholder | null };
      };
      setRows([...rows, project_stakeholder]);
      router.refresh();
    }
  }

  async function addExisting() {
    if (!existing.stakeholder_id) return;
    await attach(existing.stakeholder_id, existing.role, existing.phase);
    setAdding("none");
    setExisting({ stakeholder_id: "", role: "consulte", phase: "" });
  }

  async function addNew() {
    if (!newSt.nom.trim()) return;
    // 1. Créer le stakeholder
    const res = await fetch(`/api/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: newSt.nom.trim(),
        organisation: newSt.organisation.trim() || null,
        email: newSt.email.trim() || null,
        telephone: newSt.telephone.trim() || null,
        type: newSt.type,
      }),
    });
    if (!res.ok) return;
    const { stakeholder } = (await res.json()) as { stakeholder: Stakeholder };
    setDir([...dir, stakeholder]);
    // 2. L'associer au projet
    await attach(stakeholder.id, newSt.role, newSt.phase);
    setAdding("none");
    setNewSt({
      nom: "", organisation: "", email: "", telephone: "",
      type: "institutionnelle", role: "consulte", phase: "",
    });
  }

  async function detach(psid: string) {
    if (!confirm("Retirer cette partie prenante du projet ?")) return;
    const res = await fetch(`/api/projects/${projectId}/stakeholders/${psid}`, { method: "DELETE" });
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== psid));
      router.refresh();
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="pj-section-empty">Aucune partie prenante associée.</p>
      ) : (
        <table className="pj-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Rôle</th>
              <th>Étape</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ps) => (
              <tr key={ps.id}>
                <td>
                  {ps.stakeholder ? (
                    <button
                      type="button"
                      className="pj-contact-link"
                      onClick={() => setContactOpen(ps.stakeholder!)}
                      title="Voir la fiche contact"
                    >
                      <span className="pj-table-strong">{ps.stakeholder.nom}</span>
                      {ps.stakeholder.organisation && (
                        <span className="pj-table-sub">{ps.stakeholder.organisation}</span>
                      )}
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td>{ps.stakeholder?.type ? STAKEHOLDER_TYPE_LABELS[ps.stakeholder.type] : "—"}</td>
                <td>
                  <span className="civiq-badge civiq-badge-default">
                    {STAKEHOLDER_ROLE_LABELS[ps.role]}
                  </span>
                </td>
                <td>{ps.phase ? PROJECT_PHASE_LABELS[ps.phase as ProjectPhase] : "Tout le projet"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => detach(ps.id)}
                    className="civiq-icon-btn danger"
                    aria-label="Retirer"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding === "none" && (
        <div className="pj-add-actions">
          <button
            type="button"
            onClick={() => setAdding("existing")}
            className="civiq-btn civiq-btn-outline civiq-btn-sm"
          >
            <Plus size={14} /> Associer une partie prenante
          </button>
          <button
            type="button"
            onClick={() => setAdding("new")}
            className="civiq-btn civiq-btn-ghost civiq-btn-sm"
          >
            <UserPlus size={14} /> Créer une nouvelle
          </button>
        </div>
      )}

      {adding === "existing" && (
        <div className="pj-add-row">
          <select
            value={existing.stakeholder_id}
            className="pj-input"
            onChange={(e) => setExisting({ ...existing, stakeholder_id: e.target.value })}
          >
            <option value="">— Sélectionner —</option>
            {dir.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}{s.organisation ? ` (${s.organisation})` : ""}
              </option>
            ))}
          </select>
          <select
            value={existing.role}
            className="pj-input"
            onChange={(e) => setExisting({ ...existing, role: e.target.value as StakeholderRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{STAKEHOLDER_ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select
            value={existing.phase}
            className="pj-input"
            onChange={(e) => setExisting({ ...existing, phase: e.target.value as ProjectPhase | "" })}
          >
            <option value="">Tout le projet</option>
            {PROJECT_PHASES.map((p) => (
              <option key={p} value={p}>{PROJECT_PHASE_LABELS[p]}</option>
            ))}
          </select>
          <button type="button" onClick={addExisting} className="civiq-btn civiq-btn-default civiq-btn-sm">
            Associer
          </button>
          <button type="button" onClick={() => setAdding("none")} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
            Annuler
          </button>
        </div>
      )}

      {adding === "new" && (
        <div className="pj-add-form">
          <input
            placeholder="Nom"
            className="pj-input"
            value={newSt.nom}
            onChange={(e) => setNewSt({ ...newSt, nom: e.target.value })}
          />
          <input
            placeholder="Organisation"
            className="pj-input"
            value={newSt.organisation}
            onChange={(e) => setNewSt({ ...newSt, organisation: e.target.value })}
          />
          <input
            placeholder="Email"
            className="pj-input"
            value={newSt.email}
            onChange={(e) => setNewSt({ ...newSt, email: e.target.value })}
          />
          <input
            placeholder="Téléphone"
            className="pj-input"
            value={newSt.telephone}
            onChange={(e) => setNewSt({ ...newSt, telephone: e.target.value })}
          />
          <select
            value={newSt.type}
            className="pj-input"
            onChange={(e) => setNewSt({ ...newSt, type: e.target.value as StakeholderType })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{STAKEHOLDER_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={newSt.role}
            className="pj-input"
            onChange={(e) => setNewSt({ ...newSt, role: e.target.value as StakeholderRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>Rôle : {STAKEHOLDER_ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select
            value={newSt.phase}
            className="pj-input"
            onChange={(e) => setNewSt({ ...newSt, phase: e.target.value as ProjectPhase | "" })}
          >
            <option value="">Tout le projet</option>
            {PROJECT_PHASES.map((p) => (
              <option key={p} value={p}>{PROJECT_PHASE_LABELS[p]}</option>
            ))}
          </select>
          <div className="pj-add-form-actions">
            <button type="button" onClick={addNew} className="civiq-btn civiq-btn-default civiq-btn-sm">
              Créer &amp; associer
            </button>
            <button type="button" onClick={() => setAdding("none")} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
              Annuler
            </button>
          </div>
        </div>
      )}

      {contactOpen && (
        <ContactCard
          stakeholder={contactOpen}
          onClose={() => setContactOpen(null)}
        />
      )}
    </>
  );
}

// ─── Fiche contact (modale) ───
function ContactCard({
  stakeholder,
  onClose,
}: {
  stakeholder: Stakeholder;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="pj-contact-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pj-contact-name"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pj-contact-modal">
        <button
          type="button"
          className="pj-contact-close"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div className="pj-contact-avatar" aria-hidden>
          {stakeholder.nom
            .split(" ")
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>

        <h2 id="pj-contact-name" className="pj-contact-name">
          {stakeholder.nom}
        </h2>
        <span className="pj-contact-type">
          {STAKEHOLDER_TYPE_LABELS[stakeholder.type]}
        </span>

        {stakeholder.organisation && (
          <div className="pj-contact-org">
            <Building2 size={14} aria-hidden />
            <span>{stakeholder.organisation}</span>
          </div>
        )}

        <div className="pj-contact-fields">
          {stakeholder.email ? (
            <a
              href={`mailto:${stakeholder.email}`}
              className="pj-contact-field is-link"
            >
              <span className="pj-contact-field-icon" aria-hidden>
                <Mail size={14} />
              </span>
              <span className="pj-contact-field-text">
                <span className="pj-contact-field-label">Email</span>
                <span className="pj-contact-field-value">{stakeholder.email}</span>
              </span>
            </a>
          ) : (
            <div className="pj-contact-field is-empty">
              <span className="pj-contact-field-icon" aria-hidden>
                <Mail size={14} />
              </span>
              <span className="pj-contact-field-text">
                <span className="pj-contact-field-label">Email</span>
                <span className="pj-contact-field-value">—</span>
              </span>
            </div>
          )}

          {stakeholder.telephone ? (
            <a
              href={`tel:${stakeholder.telephone.replace(/\s/g, "")}`}
              className="pj-contact-field is-link"
            >
              <span className="pj-contact-field-icon" aria-hidden>
                <Phone size={14} />
              </span>
              <span className="pj-contact-field-text">
                <span className="pj-contact-field-label">Téléphone</span>
                <span className="pj-contact-field-value">{stakeholder.telephone}</span>
              </span>
            </a>
          ) : (
            <div className="pj-contact-field is-empty">
              <span className="pj-contact-field-icon" aria-hidden>
                <Phone size={14} />
              </span>
              <span className="pj-contact-field-text">
                <span className="pj-contact-field-label">Téléphone</span>
                <span className="pj-contact-field-value">—</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

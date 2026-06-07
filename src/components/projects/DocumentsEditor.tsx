"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ExternalLink, Trash2, Loader2, File as FileIcon } from "lucide-react";
import type { ProjectDocument, ProjectDocumentType } from "@/lib/projects/types";

interface Props {
  projectId: string;
  initial: ProjectDocument[];
  canEdit: boolean;
}

const TYPE_LABELS: Record<ProjectDocumentType, string> = {
  fiche_projet: "Fiche projet",
  deliberation: "Délibération",
  devis: "Devis",
  plan_financement: "Plan de financement",
  autre: "Autre",
};

const TYPES: ProjectDocumentType[] = [
  "fiche_projet", "deliberation", "devis", "plan_financement", "autre",
];

// ═══════════════════════════════════════════════════════════════
// DocumentsEditor — liste + upload + suppression de documents.
// Bucket privé : URL signées 7 jours regénérées par le serveur.
// ═══════════════════════════════════════════════════════════════

export default function DocumentsEditor({ projectId, initial, canEdit }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ProjectDocumentType>("autre");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const form = new FormData();
    form.append("file", file);
    form.append("nom", file.name);
    form.append("type", type);

    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { document?: ProjectDocument; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `Erreur ${res.status}`);
      } else if (data.document) {
        setDocs([data.document, ...docs]);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function remove(did: string) {
    if (!confirm("Supprimer ce document ?")) return;
    const res = await fetch(`/api/projects/${projectId}/documents/${did}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDocs(docs.filter((d) => d.id !== did));
      router.refresh();
    }
  }

  return (
    <>
      {docs.length === 0 ? (
        <p className="pj-section-empty">Aucun document joint.</p>
      ) : (
        <ul className="pj-docs">
          {docs.map((d) => (
            <li key={d.id} className="pj-doc-row">
              <a href={d.url} target="_blank" rel="noreferrer" className="pj-doc-link">
                <FileIcon size={14} />
                <div>
                  <div className="pj-doc-name">{d.nom}</div>
                  <div className="pj-doc-meta">{TYPE_LABELS[d.type]}</div>
                </div>
                <ExternalLink size={12} className="pj-doc-external" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="civiq-icon-btn danger"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="pj-doc-upload">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ProjectDocumentType)}
            className="pj-input"
            disabled={uploading}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          <label className="civiq-btn civiq-btn-outline civiq-btn-sm pj-doc-upload-btn">
            {uploading ? <Loader2 className="spin" size={14} /> : <Upload size={14} />}
            {uploading ? "Envoi…" : "Choisir un fichier"}
            <input
              type="file"
              onChange={handleFile}
              disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}
      {error && (
        <div className="pj-modal-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {canEdit && (
        <p className="pj-table-sub" style={{ marginTop: 6 }}>
          PDF, Word, Excel ou images. Max 20 MB. Stockage privé.
        </p>
      )}
    </>
  );
}

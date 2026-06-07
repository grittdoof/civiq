"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, ArrowLeft } from "lucide-react";

interface Options {
  counts: { tous: number; ouverts: number; cloture: number };
  users: Array<{ id: string; full_name: string | null; count: number }>;
}

// ═══════════════════════════════════════════════════════════════
// PdfChooser — formulaire de sélection avant génération.
// Filtre statut (radio) + assignés (multi-checkbox).
// Au submit, redirige vers /tickets-pdf?go=1&filter=...&assignees=...
// qui lance le PdfLoader.
// ═══════════════════════════════════════════════════════════════

export default function PdfChooser() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialFilter = (sp.get("filter") as "tous" | "ouverts" | "cloture" | null) ?? "ouverts";
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"tous" | "ouverts" | "cloture">(initialFilter);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tickets/pdf-options", { credentials: "include" });
        if (res.ok) setOpts(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!opts) return;
    setSelected(new Set(opts.users.map((u) => u.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  function go() {
    const params = new URLSearchParams();
    params.set("go", "1");
    params.set("filter", filter);
    if (selected.size > 0) params.set("assignees", [...selected].join(","));
    router.push(`/tickets-pdf?${params.toString()}`);
  }

  if (loading) {
    return (
      <main className="tk-pdf-loader">
        <div className="tk-pdf-loader-card">
          <div className="tk-pdf-loader-icon tk-pdf-loader-icon--spin">
            <FileText size={26} strokeWidth={1.7} />
            <span className="tk-pdf-loader-ring" aria-hidden />
          </div>
          <h1 className="tk-pdf-loader-title">Préparation des options…</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="tk-pdf-loader">
      <div className="tk-pdf-chooser">
        <div className="tk-pdf-chooser-header">
          <button
            type="button"
            onClick={() => router.back()}
            className="civiq-btn civiq-btn-ghost civiq-btn-sm"
          >
            <ArrowLeft size={14} /> Retour
          </button>
          <h1 className="tk-pdf-chooser-title">Exporter les tickets en PDF</h1>
        </div>

        <section className="tk-pdf-chooser-section">
          <h2 className="tk-pdf-chooser-subtitle">Quels tickets ?</h2>
          <div className="tk-pdf-chooser-radio-group">
            <label className={`tk-pdf-chooser-radio ${filter === "ouverts" ? "is-checked" : ""}`}>
              <input type="radio" checked={filter === "ouverts"} onChange={() => setFilter("ouverts")} />
              <span>Ouverts</span>
              <span className="tk-pdf-chooser-count">{opts?.counts.ouverts ?? 0}</span>
            </label>
            <label className={`tk-pdf-chooser-radio ${filter === "cloture" ? "is-checked" : ""}`}>
              <input type="radio" checked={filter === "cloture"} onChange={() => setFilter("cloture")} />
              <span>Clôturés</span>
              <span className="tk-pdf-chooser-count">{opts?.counts.cloture ?? 0}</span>
            </label>
            <label className={`tk-pdf-chooser-radio ${filter === "tous" ? "is-checked" : ""}`}>
              <input type="radio" checked={filter === "tous"} onChange={() => setFilter("tous")} />
              <span>Tous</span>
              <span className="tk-pdf-chooser-count">{opts?.counts.tous ?? 0}</span>
            </label>
          </div>
        </section>

        {opts && opts.users.length > 0 && (
          <section className="tk-pdf-chooser-section">
            <div className="tk-pdf-chooser-section-head">
              <h2 className="tk-pdf-chooser-subtitle">
                Filtrer par agent rattaché (optionnel)
              </h2>
              <div className="tk-pdf-chooser-bulk">
                <button type="button" onClick={selectAll} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                  Tout cocher
                </button>
                <button type="button" onClick={selectNone} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
                  Tout décocher
                </button>
              </div>
            </div>
            <p className="tk-pdf-chooser-hint">
              Aucune coche = inclure tous les tickets correspondant au filtre.
              Seuls les agents avec au moins 1 ticket sont listés.
            </p>
            <ul className="tk-pdf-chooser-users">
              {opts.users.map((u) => (
                <li key={u.id} className="tk-pdf-chooser-user">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                    />
                    <span className="tk-pdf-chooser-user-name">{u.full_name ?? u.id}</span>
                    <span className="tk-pdf-chooser-count">{u.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="tk-pdf-chooser-actions">
          <button
            type="button"
            onClick={go}
            className="civiq-btn civiq-btn-default"
          >
            <FileText size={14} /> Générer le PDF
          </button>
        </div>
      </div>
    </main>
  );
}

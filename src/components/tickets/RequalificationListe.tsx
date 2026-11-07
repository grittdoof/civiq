"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { updateTicket } from "@/lib/tickets/mutations";
import { arborescence, type CategorieTicket } from "@/lib/tickets/categories";

// ═══════════════════════════════════════════════════════════════
// Requalification des signalements « Autre » (lot 2) : une sous-
// catégorie est suggérée d'après le titre et la description ; chaque
// changement passe par updateTicket (droits, journal, audit).
// ═══════════════════════════════════════════════════════════════

export interface LigneRequalif {
  id: string;
  numero: number;
  titre: string;
  extrait: string | null;
  suggestion: string | null;
}

export default function RequalificationListe({ lignes, categories }: { lignes: LigneRequalif[]; categories: CategorieTicket[] }) {
  const router = useRouter();
  const arbre = arborescence(categories, { actifsSeulement: true });
  const [choix, setChoix] = useState<Record<string, string>>(
    Object.fromEntries(lignes.map((l) => [l.id, l.suggestion ?? ""])),
  );
  const [faits, setFaits] = useState<Set<string>>(new Set());
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [encours, setEncours] = useState<string | null>(null);

  async function appliquer(ids: string[]) {
    for (const id of ids) {
      const categorieId = choix[id];
      if (!categorieId || faits.has(id)) continue;
      setEncours(id);
      try {
        await updateTicket({ ticketId: id, categorie_id: categorieId });
        setFaits((s) => new Set(s).add(id));
        setErreurs((e) => { const { [id]: _, ...reste } = e; return reste; });
      } catch (e) {
        setErreurs((x) => ({ ...x, [id]: e instanceof Error ? e.message : "Erreur" }));
      }
    }
    setEncours(null);
    router.refresh();
  }

  const avecChoix = lignes.filter((l) => choix[l.id] && !faits.has(l.id)).map((l) => l.id);

  if (lignes.length === 0) {
    return <div className="civiq-card" style={{ padding: 20, color: "var(--fg-muted)", fontSize: 14 }}>Aucun ticket à requalifier.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="civiq-btn civiq-btn-default" disabled={pending || avecChoix.length === 0}
          onClick={() => startTransition(() => appliquer(avecChoix))}>
          {pending ? <Loader2 size={14} className="civiq-spin" /> : <Check size={14} />} Appliquer les {avecChoix.length} choix
        </button>
        <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{faits.size} requalifié{faits.size > 1 ? "s" : ""} sur {lignes.length}</span>
      </div>
      {lignes.map((l) => {
        const fait = faits.has(l.id);
        return (
          <div key={l.id} className="civiq-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", opacity: fait ? 0.6 : 1 }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <Link href={`/admin/tickets/${l.id}`} style={{ fontWeight: 600, fontSize: 14, textDecoration: "none", color: "var(--fg)" }}>
                <span style={{ color: "var(--fg-xmuted)", fontWeight: 500, marginRight: 6 }}>#{l.numero}</span>{l.titre}
              </Link>
              {l.extrait && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.extrait}</p>}
            </div>
            <label style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11.5, color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                {l.suggestion && choix[l.id] === l.suggestion ? <><Sparkles size={11} aria-hidden="true" /> Suggestion</> : "Nouvelle catégorie"}
              </span>
              <select className="civiq-input" disabled={fait} value={choix[l.id] ?? ""} onChange={(e) => setChoix((c) => ({ ...c, [l.id]: e.target.value }))} style={{ height: 38, fontSize: 13.5 }}>
                <option value="">Laisser en « Autre »</option>
                {arbre.filter((r) => r.code !== "autre").map((r) => (
                  <optgroup key={r.id} label={r.libelle}>
                    <option value={r.id}>{r.libelle} (sans précision)</option>
                    {r.enfants.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="button" className="civiq-btn civiq-btn-outline" disabled={fait || !choix[l.id] || encours === l.id}
              onClick={() => startTransition(() => appliquer([l.id]))} style={{ fontSize: 13 }}>
              {encours === l.id ? <Loader2 size={14} className="civiq-spin" /> : fait ? <Check size={14} /> : null} {fait ? "Fait" : "Appliquer"}
            </button>
            {erreurs[l.id] && <p role="alert" style={{ flexBasis: "100%", margin: 0, fontSize: 12.5, color: "var(--destructive)" }}>{erreurs[l.id]}</p>}
          </div>
        );
      })}
    </div>
  );
}

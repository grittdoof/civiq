"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Pills de filtre + barre de recherche pour /admin/tickets
// Les filtres écrivent dans l'URL (?filter=…&search=…) pour que
// la page Server Component re-fetche avec les bons critères.
// ═══════════════════════════════════════════════════════════════

export type TicketsFilterValue =
  | "tous" | "nouveau" | "en_cours" | "urgents" | "mes_tickets" | "clos";

interface Counts {
  tous: number;
  nouveau: number;
  en_cours: number;
  urgents: number;
  mes_tickets: number;
  clos: number;
}

interface Props {
  currentFilter: TicketsFilterValue;
  currentSearch: string;
  counts: Counts;
}

const PILLS: { value: TicketsFilterValue; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "nouveau", label: "Nouveaux" },
  { value: "en_cours", label: "En cours" },
  { value: "urgents", label: "Urgents" },
  { value: "mes_tickets", label: "Mes tickets" },
  { value: "clos", label: "Clos" },
];

export default function TicketsFilters({ currentFilter, currentSearch, counts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [, startTransition] = useTransition();

  // Sync l'input si l'URL change extérieurement
  useEffect(() => { setSearch(currentSearch); }, [currentSearch]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(`/admin/tickets?${params.toString()}`);
    });
  }

  // Debounce sur la recherche (300ms)
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== currentSearch) setParam("search", search);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <div className="tk-pills">
        {PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`tk-pill${currentFilter === p.value ? " active" : ""}`}
            onClick={() => setParam("filter", p.value === "tous" ? "" : p.value)}
          >
            {p.label}
            <span className="tk-pill-count">{counts[p.value]}</span>
          </button>
        ))}
      </div>

      <div className="tk-toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: "absolute", left: 11, top: "50%",
              transform: "translateY(-50%)", color: "var(--fg-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, description ou #numéro…"
            className="tk-search-input"
            style={{ paddingLeft: 32, width: "100%" }}
          />
        </div>
      </div>
    </>
  );
}

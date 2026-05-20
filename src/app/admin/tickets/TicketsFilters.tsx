"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TKFilterPill, TKSearchBar } from "@/components/tickets/ui/tk-primitives";

// ═══════════════════════════════════════════════════════════════
// Pills de filtre + barre de recherche pour /admin/tickets
// (refondu phase 2 — style Airbnb).
// ═══════════════════════════════════════════════════════════════

export type TicketsFilterValue =
  | "mes"
  | "ouverts"
  | "urgents"
  | "termines"
  | "tous";

interface Counts {
  mes: number;
  ouverts: number;
  urgents: number;
  termines: number;
  tous: number;
}

interface Props {
  currentFilter: TicketsFilterValue;
  currentSearch: string;
  counts: Counts;
}

const PILLS: { value: TicketsFilterValue; label: string }[] = [
  { value: "mes", label: "Mes tickets" },
  { value: "ouverts", label: "En cours" },
  { value: "urgents", label: "Urgents" },
  { value: "termines", label: "Clôturés" },
  { value: "tous", label: "Tous" },
];

export default function TicketsFilters({
  currentFilter,
  currentSearch,
  counts,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSearch(currentSearch);
  }, [currentSearch]);

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
      <div className="px-[22px] pb-3.5 pt-1 md:px-8">
        <TKSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un ticket, une adresse…"
        />
      </div>

      <div className="overflow-x-auto px-[22px] pb-3.5 md:px-8">
        <div className="inline-flex gap-2">
          {PILLS.map((p) => (
            <TKFilterPill
              key={p.value}
              active={currentFilter === p.value}
              count={counts[p.value]}
              onClick={() => setParam("filter", p.value)}
            >
              {p.label}
            </TKFilterPill>
          ))}
        </div>
      </div>
    </>
  );
}

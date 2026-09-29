"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, ChevronDown, HandCoins, Settings, TrendingUp, Users } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Menu « Autres vues » du portefeuille : liste déroulante accrochée au
// bouton (plus de panneau latéral sur fond assombri). Se ferme au clic
// extérieur, à Échap ou en choisissant une vue.
// ═══════════════════════════════════════════════════════════════

const VUES = [
  { href: "/admin/projects/ppi", label: "Plan pluriannuel d'investissement", description: "Les investissements année par année, hors taxes.", Icon: TrendingUp },
  { href: "/admin/projects/comparatif", label: "Comparatif des coûts", description: "Coût global sur 10 ans des investissements.", Icon: BarChart3 },
  { href: "/admin/projects/revue-mensuelle", label: "Revue mensuelle", description: "Retards, échéances et alertes, à imprimer.", Icon: CalendarDays },
  { href: "/admin/projects/cartographie", label: "Cartographie des parties prenantes", description: "Qui intervient sur quel projet.", Icon: Users },
  { href: "/admin/projects/financeurs", label: "Financeurs", description: "Aides publiques du territoire et financeurs locaux.", Icon: HandCoins },
  { href: "/admin/projects/parametres", label: "Paramètres de la commune", description: "Délégation au maire, achats, récupération de la TVA.", Icon: Settings },
];

export default function PortfolioActionsDrawer() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="pj-dropdown" ref={ref}>
      <button type="button" className="civiq-btn civiq-btn-outline" aria-expanded={open} aria-controls="pj-autres-vues" onClick={() => setOpen((o) => !o)}>
        Autres vues <ChevronDown size={14} aria-hidden="true" className={open ? "pj-learn-more-chevron open" : "pj-learn-more-chevron"} />
      </button>
      {open && (
        <ul id="pj-autres-vues" className="pj-dropdown-panel pj-dropdown-right">
          {VUES.map(({ href, label, description, Icon }) => (
            <li key={href}>
              <Link href={href} className="pj-dropdown-item" prefetch={false} onClick={() => setOpen(false)}>
                <span className="pj-dropdown-icon" aria-hidden="true"><Icon size={16} /></span>
                <span className="pj-dropdown-copy">
                  <strong>{label}</strong>
                  <span>{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

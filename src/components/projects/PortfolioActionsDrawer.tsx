"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  BarChart3,
  Users,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import RightDrawer from "./RightDrawer";

// ═══════════════════════════════════════════════════════════════
// PortfolioActionsDrawer — regroupe dans un panneau off-canvas
// droit les actions secondaires du header portefeuille projets :
//   • Comparatif coûts
//   • Cartographie parties prenantes
//   • Revue mensuelle
//   • PPI
//
// Le header ne garde que les contrôles primaires (vue, commission,
// gabarit, nouveau projet).
// ═══════════════════════════════════════════════════════════════

export default function PortfolioActionsDrawer() {
  const [open, setOpen] = useState(false);

  const links: Array<{
    href: string;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      href: "/admin/projects/comparatif",
      label: "Comparatif coûts",
      description: "Comparer les projets sur leur coût global 10 ans.",
      icon: <BarChart3 size={18} />,
    },
    {
      href: "/admin/projects/cartographie",
      label: "Cartographie parties prenantes",
      description: "Vue transversale des acteurs par projet.",
      icon: <Users size={18} />,
    },
    {
      href: "/admin/projects/revue-mensuelle",
      label: "Revue mensuelle",
      description: "Synthèse imprimable pour la revue de direction.",
      icon: <CalendarDays size={18} />,
    },
    {
      href: "/admin/projects/ppi",
      label: "PPI",
      description: "Plan Pluriannuel d'Investissement.",
      icon: <TrendingUp size={18} />,
    },
  ];

  return (
    <>
      <button
        type="button"
        className="civiq-btn civiq-btn-outline"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Autres vues du portefeuille"
      >
        <MoreHorizontal size={14} /> <span>Plus</span>
      </button>

      <RightDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Vues transversales"
      >
        <p className="pj-drawer-help">
          Accédez aux vues synthétiques du portefeuille.
        </p>
        <ul className="pj-actions-list">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="pj-actions-item"
                onClick={() => setOpen(false)}
                prefetch={false}
              >
                <span className="pj-actions-icon" aria-hidden>{l.icon}</span>
                <span className="pj-actions-copy">
                  <strong>{l.label}</strong>
                  <em>{l.description}</em>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </RightDrawer>
    </>
  );
}

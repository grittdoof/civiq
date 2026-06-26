"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { usePushNavigationListener } from "@/hooks/usePushNavigationListener";
import PushSubscriptionPrompt from "@/components/tickets/PushSubscriptionPrompt";
import NavPendingLink from "@/components/ui/NavPendingLink";
import {
  Settings, LogOut, Menu, X, Shield,
  LayoutDashboard, FileText, Plus, BarChart3,
  Wrench, Map as MapIcon, HelpCircle, Inbox, Bell,
  FolderKanban, Gavel, CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// ADMIN SHELL — Sidebar 4 groupes (design Claude Design / chat
// transcript). La garde d'auth est en amont (Server Layout).
//
// Groupes :
//   • (no label) — Tableau de bord (toujours visible)
//   • Sondages   — Mes sondages, Statistiques, + Nouveau sondage
//   • Support    — Tickets, Carte tickets, + Nouveau ticket
//   • Outil      — Profil & paramètres, Aide
//
// Les actions « + Nouveau … » utilisent le style civiq-nav-action
// (tiret pointillé bleu) pour se distinguer des pages.
// ═══════════════════════════════════════════════════════════════

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Affiché en style « action » (tiret pointillé) */
  action?: boolean;
  /** Modules requis pour afficher l'item — undefined = toujours */
  modules?: string[];
  /** Rôles autorisés — undefined = tous */
  roles?: string[];
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/admin/dashboard", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Sondages",
    items: [
      { href: "/admin/surveys", label: "Mes sondages", icon: FileText, exact: true, modules: ["surveys"] },
      { href: "/admin/surveys/new", label: "Nouveau sondage", icon: Plus, exact: true, modules: ["surveys"], action: true, roles: ["admin", "super_admin"] },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/admin/tickets", label: "Tickets", icon: Inbox, exact: true, modules: ["tickets"] },
      { href: "/admin/tickets/carte", label: "Carte", icon: MapIcon, exact: true, modules: ["tickets"] },
      { href: "/admin/tickets/stats", label: "Statistiques", icon: BarChart3, exact: true, modules: ["tickets"] },
      { href: "/admin/tickets/nouveau", label: "Nouveau ticket", icon: Plus, exact: true, modules: ["tickets"], action: true, roles: ["admin", "editor", "super_admin"] },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { href: "/admin/projects", label: "Projets", icon: FolderKanban, exact: true, modules: ["projects"] },
      { href: "/admin/commissions", label: "Commissions", icon: Gavel, exact: true, modules: ["projects"] },
      { href: "/admin/calendrier", label: "Calendrier", icon: CalendarDays, exact: true, modules: ["projects"] },
      { href: "/admin/projects/nouveau", label: "Nouveau projet", icon: Plus, exact: true, modules: ["projects"], action: true, roles: ["admin", "editor", "super_admin"] },
    ],
  },
  {
    label: "Outil",
    items: [
      { href: "/admin/profile#notifications", label: "Notifications", icon: Bell, exact: false },
      { href: "/admin/aide", label: "Aide", icon: HelpCircle, exact: true },
      { href: "/admin/profile", label: "Profil & paramètres", icon: Settings, exact: false },
    ],
  },
];

interface Props {
  children: React.ReactNode;
  commune: { name: string; slug: string } | null;
  isSuperAdmin: boolean;
  role: string | null;
  initialActiveModuleKeys: string[];
}

export default function AdminShell({ children, commune, isSuperAdmin, role, initialActiveModuleKeys }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModuleKeys] = useState<string[]>(initialActiveModuleKeys);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSetup = pathname === "/admin/setup";

  // Navigation depuis une notification push (cf. public/sw.js)
  usePushNavigationListener();

  // Filtre les groupes selon les modules activés et le rôle
  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const items = group.items.filter((it) => {
        if (it.modules && !it.modules.some((m) => activeModuleKeys.includes(m) || isSuperAdmin)) return false;
        if (it.roles && role && !it.roles.includes(role)) return false;
        return true;
      });
      return { ...group, items };
    }).filter((g) => g.items.length > 0);
  }, [activeModuleKeys, role, isSuperAdmin]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  if (isSetup) return <>{children}</>;

  const userInitial = (commune?.name?.[0] ?? "U").toUpperCase();
  const roleLabel =
    role === "super_admin" ? "Super Admin" :
    role === "admin" ? "Administrateur" :
    role === "editor" ? "Éditeur" :
    role === "viewer" ? "Lecteur" : "—";

  const sidebar = (
    <aside className="civiq-sidebar">
      {/* Logo officiel GoCiviq (charte République) */}
      <div className="civiq-sidebar-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-horizontal.svg"
          alt="GoCiviq"
          style={{ height: 28, width: "auto", display: "block" }}
        />
      </div>

      {/* Bloc commune */}
      {commune && (
        <div style={{ padding: "6px 10px 10px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "9px 10px",
            background: "var(--border-light)",
            borderRadius: "var(--radius-sm)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "var(--radius-sm)", flexShrink: 0,
              background: "var(--accent)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>{userInitial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {commune.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 1, fontFamily: "ui-monospace, monospace" }}>/{commune.slug}</div>
            </div>
            {isSuperAdmin && (
              <span className="civiq-badge civiq-badge-warning" style={{ flexShrink: 0 }}>
                Super Admin
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Lien super-admin (uniquement si rôle super_admin) */}
      {isSuperAdmin && (
        <div style={{ padding: "8px 10px 0" }}>
          <NavPendingLink
            href="/super-admin/dashboard"
            className="civiq-nav-item"
            style={{ color: "var(--accent)", fontWeight: 600 }}
            onClick={() => setMobileOpen(false)}
            icon={Shield}
            label="Espace Super Admin"
          />
        </div>
      )}

      {/* Groupes de nav */}
      <nav className="civiq-sidebar-nav" style={{ gap: 0, paddingTop: 6 }}>
        {visibleGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: gi < visibleGroups.length - 1 ? 4 : 0 }}>
            {group.label && (
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.09em", color: "var(--fg-xmuted)",
                padding: "8px 10px 4px",
              }}>
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavPendingLink
                key={item.href + item.label}
                href={item.href}
                className={`civiq-nav-item${isActive(item) ? " active" : ""}${item.action ? " civiq-nav-action" : ""}`}
                onClick={() => setMobileOpen(false)}
                icon={item.icon}
                label={item.label}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer : avatar + logout */}
      <div className="civiq-sidebar-footer">
        <div style={{ height: 1, background: "var(--border)", marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "var(--accent)", color: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>{userInitial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {commune?.name ?? "Mon compte"}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{roleLabel}</div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="civiq-icon-btn"
            title="Déconnexion"
            aria-label="Déconnexion"
            style={{ flexShrink: 0 }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="civiq-app">
      <button
        className="civiq-mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="Menu"
        type="button"
      >
        <Menu size={18} />
      </button>
      <div className="civiq-sidebar-desktop">{sidebar}</div>
      {mobileOpen && (
        <div className="civiq-sidebar-overlay" onClick={() => setMobileOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="civiq-sidebar-mobile">
            <button
              className="civiq-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              type="button"
            >
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <div className="civiq-content">{children}</div>
      {/* Prompt d'activation push : visible sur toutes les pages admin
          (pas seulement /admin/tickets) — caché si déjà souscrit ou refusé */}
      <PushSubscriptionPrompt />
    </div>
  );
}

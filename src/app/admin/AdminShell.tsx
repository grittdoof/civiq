"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Settings, LogOut, Menu, X, Shield } from "lucide-react";
import { getAdminNavForModules } from "@/modules/registry";

// ═══════════════════════════════════════════════════
// ADMIN SHELL — UI client (sidebar dynamique)
// La garde d'authentification est faite en amont par
// src/app/admin/layout.tsx (Server Component).
// ═══════════════════════════════════════════════════

const CORE_NAV_ITEMS = [
  { href: "/admin/profile", label: "Profil & paramètres", icon: Settings, exact: false },
];

interface Props {
  children: React.ReactNode;
  commune: { name: string; slug: string } | null;
  isSuperAdmin: boolean;
  initialActiveModuleKeys: string[];
}

export default function AdminShell({ children, commune, isSuperAdmin, initialActiveModuleKeys }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModuleKeys] = useState<string[]>(initialActiveModuleKeys);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSetup = pathname === "/admin/setup";

  const navItems = useMemo(
    () => [...getAdminNavForModules(activeModuleKeys), ...CORE_NAV_ITEMS],
    [activeModuleKeys]
  );

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function isActive(item: { href: string; exact?: boolean }) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  if (isSetup) return <>{children}</>;

  const sidebar = (
    <aside className="civiq-sidebar">
      <div className="civiq-sidebar-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="10" width="20" height="12" rx="1.5" fill="var(--accent)" />
          <rect x="6" y="6" width="12" height="5" rx="1" fill="var(--accent)" opacity="0.6" />
          <rect x="9" y="2" width="6" height="5" rx="1" fill="var(--accent)" opacity="0.35" />
          <rect x="9" y="14" width="2" height="5" fill="white" opacity="0.9" rx="0.5" />
          <rect x="13" y="14" width="2" height="5" fill="white" opacity="0.9" rx="0.5" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.03em", color: "var(--fg)" }}>GoCiviQ</span>
      </div>
      <div style={{ height: 1, background: "var(--border)" }} />

      {commune && (
        <div className="civiq-sidebar-municipality">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", display: "block", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{commune.name}</div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 1 }}>/{commune.slug}</div>
            </div>
          </div>
          {isSuperAdmin && <span className="civiq-badge civiq-badge-warning">Super Admin</span>}
        </div>
      )}

      <div style={{ height: 1, background: "var(--border)" }} />

      {isSuperAdmin && (
        <div style={{ padding: "8px 10px 0" }}>
          <Link href="/super-admin/dashboard" className="civiq-nav-item" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => setMobileOpen(false)}>
            <Shield size={15} /> <span>Espace Super Admin</span>
          </Link>
        </div>
      )}

      <nav className="civiq-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`civiq-nav-item${isActive(item) ? " active" : ""}`} onClick={() => setMobileOpen(false)}>
              <Icon size={15} /><span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="civiq-sidebar-footer">
        <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />
        <button type="button" onClick={handleLogout} className="civiq-nav-item" style={{ width: "100%", color: "var(--fg-muted)" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {commune?.name?.[0]?.toUpperCase() || "A"}
          </div>
          <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>Déconnexion</span>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );

  return (
    <div className="civiq-app">
      <button className="civiq-mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Menu" type="button">
        <Menu size={18} />
      </button>
      <div className="civiq-sidebar-desktop">{sidebar}</div>
      {mobileOpen && (
        <div className="civiq-sidebar-overlay" onClick={() => setMobileOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="civiq-sidebar-mobile">
            <button className="civiq-close-btn" onClick={() => setMobileOpen(false)} type="button">
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <div className="civiq-content">{children}</div>
    </div>
  );
}

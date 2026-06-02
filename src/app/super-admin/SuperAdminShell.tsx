"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  LayoutDashboard,
  Building2,
  Users,
  Boxes,
  ShieldCheck,
  Inbox,
  LogOut,
  Shield,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// SUPER-ADMIN LAYOUT — Sidebar sombre (plateforme)
// ═══════════════════════════════════════════════════

const NAV = [
  { href: "/super-admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/super-admin/requests",  label: "Demandes",         icon: Inbox },
  { href: "/super-admin/communes",  label: "Communes",        icon: Building2 },
  { href: "/super-admin/users",     label: "Utilisateurs",    icon: Users },
  { href: "/super-admin/modules",   label: "Modules",          icon: Boxes },
  { href: "/super-admin/rgpd",      label: "RGPD",             icon: ShieldCheck },
];

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const sidebar = (
    <aside style={{
      width: 248,
      minHeight: "100dvh",
      background: "oklch(0.13 0.010 258)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <Shield size={17} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.03em", color: "#fff" }}>GoCiviq</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Super Admin</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--accent)" : "rgba(255,255,255,0.6)",
                background: active ? "var(--accent-light)" : "transparent",
                transition: "all 0.12s",
              }}
            >
              <Icon size={15} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "0 10px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
        <Link
          href="/admin/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            marginBottom: 4,
            transition: "all 0.12s",
          }}
        >
          <ArrowLeft size={14} /> Espace commune
        </Link>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "none",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            cursor: "pointer",
            width: "100%",
            fontFamily: "inherit",
            fontWeight: 500,
            transition: "all 0.12s",
          }}
        >
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </aside>
  );

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Mobile header */}
      <header style={{
        display: "none",
        position: "fixed", top: 0, left: 0, right: 0,
        zIndex: 50,
        background: "oklch(0.13 0.010 258)",
        padding: "14px 20px",
        alignItems: "center",
        justifyContent: "space-between",
      }} className="sa-mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 700 }}>
          <Shield size={16} /> GoCiviq Admin
        </div>
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Backdrop overlay (visible quand le drawer mobile est ouvert) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "oklch(0 0 0 / 0.5)",
            zIndex: 200,
            backdropFilter: "blur(2px)",
          }}
          className="sa-overlay"
          aria-hidden
        />
      )}

      {/* Sidebar :
            - Desktop : inline en colonne gauche
            - Mobile  : drawer fixe glissant depuis la gauche (data-open) */}
      <div className="sa-sidebar-wrap" data-open={open ? "true" : "false"}>
        {sidebar}
      </div>

      {/* Main */}
      <main className="sa-main" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sa-mobile-header { display: flex !important; }
          .sa-main { padding-top: 60px; }

          /* Drawer mobile : positionné en absolu hors écran, glisse à l'ouverture */
          .sa-sidebar-wrap {
            position: fixed;
            top: 0; left: 0;
            height: 100dvh;
            z-index: 201;
            transform: translateX(-100%);
            transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
            box-shadow: 0 0 24px rgba(0, 0, 0, 0.25);
          }
          .sa-sidebar-wrap[data-open="true"] {
            transform: translateX(0);
          }
          /* La sidebar elle-même garde sa hauteur native */
          .sa-sidebar-wrap aside {
            min-height: 100dvh;
            max-height: 100dvh;
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}

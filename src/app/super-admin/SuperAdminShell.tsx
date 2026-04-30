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
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.03em", color: "#fff" }}>GoCiviQ</div>
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
          <Shield size={16} /> GoCiviQ Admin
        </div>
        <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.5)", zIndex: 200, backdropFilter: "blur(2px)", display: "none" }}
          className="sa-overlay"
        />
      )}

      {/* Desktop sidebar */}
      <div className="sa-sidebar-wrap">{sidebar}</div>

      {/* Main */}
      <main className="sa-main" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sa-mobile-header { display: flex !important; }
          .sa-overlay { display: block !important; }
          .sa-main { padding-top: 60px; }
          .sa-sidebar-wrap { display: none; }
        }
      `}</style>
    </div>
  );
}

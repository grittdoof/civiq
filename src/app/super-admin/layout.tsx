"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  LayoutDashboard,
  Building2,
  Users,
  Boxes,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// SUPER-ADMIN LAYOUT — Plateforme management
// Réservé aux users avec role = 'super_admin'
// ═══════════════════════════════════════════════════

const NAV = [
  { href: "/super-admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/super-admin/communes", label: "Communes", icon: Building2 },
  { href: "/super-admin/users", label: "Utilisateurs", icon: Users },
  { href: "/super-admin/modules", label: "Modules", icon: Boxes },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.replace("/auth/login");
        return;
      }
      const data = await res.json();
      if (!data.is_super_admin) {
        router.replace("/admin/dashboard");
        return;
      }
      setAuthChecked(true);
    } catch {
      router.replace("/auth/login");
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (!authChecked) {
    return (
      <div className="sa-loading">
        <div className="civiq-spin" style={{ width: 32, height: 32, border: "3px solid #ebebeb", borderTopColor: "#222", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div className="sa-root">
      {/* Mobile header */}
      <header className="sa-mobile-header">
        <Link href="/super-admin/dashboard" className="sa-mobile-logo">
          <Shield size={18} /> CiviQ Admin
        </Link>
        <button onClick={() => setOpen(!open)} className="sa-hamburger" aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {open && <div className="sa-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sa-sidebar ${open ? "open" : ""}`}>
        <div className="sa-logo">
          <div className="sa-logo-badge">
            <Shield size={18} />
          </div>
          <div>
            <strong>CiviQ</strong>
            <span>Super Admin</span>
          </div>
        </div>

        <nav className="sa-nav">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`sa-nav-item ${active ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sa-bottom">
          <Link href="/admin/dashboard" className="sa-back-link">
            ← Espace commune
          </Link>
          <button onClick={handleLogout} className="sa-logout">
            <LogOut size={15} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="sa-main">{children}</main>

      <style>{`
        .sa-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--civiq-bg);
        }
        .sa-root {
          display: flex;
          min-height: 100vh;
          background: var(--civiq-bg);
        }
        .sa-sidebar {
          width: 260px;
          min-height: 100vh;
          background: #1c1c1c;
          color: #fff;
          position: fixed;
          left: 0; top: 0; bottom: 0;
          z-index: 40;
          display: flex;
          flex-direction: column;
          transition: transform 0.25s ease;
        }
        .sa-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 20px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .sa-logo-badge {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ff5a5f, #e0454a);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
        }
        .sa-logo strong { display: block; font-family: 'Playfair Display', serif; font-size: 18px; color: #fff; }
        .sa-logo span { font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.08em; }

        .sa-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; }
        .sa-nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: 0.15s;
        }
        .sa-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .sa-nav-item.active { background: rgba(255,90,95,0.15); color: #ff8a8e; }

        .sa-bottom {
          padding: 14px 12px 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sa-back-link {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 8px 12px;
          border-radius: 8px;
          transition: 0.15s;
        }
        .sa-back-link:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
        .sa-logout {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          background: none;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.65);
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          transition: 0.15s;
        }
        .sa-logout:hover { background: rgba(255,255,255,0.06); color: #fff; }

        .sa-main {
          margin-left: 260px;
          flex: 1;
          min-width: 0;
        }

        /* Mobile */
        .sa-mobile-header {
          display: none;
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 50;
          background: #1c1c1c;
          padding: 14px 20px;
          align-items: center;
          justify-content: space-between;
        }
        .sa-mobile-logo {
          display: inline-flex; align-items: center; gap: 8px;
          color: #fff; font-weight: 700; text-decoration: none;
          font-family: 'Playfair Display', serif;
        }
        .sa-hamburger {
          background: none; border: none; color: #fff; cursor: pointer;
        }
        .sa-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 35;
        }
        @media (max-width: 768px) {
          .sa-mobile-header { display: flex; }
          .sa-overlay { display: block; }
          .sa-main { margin-left: 0; padding-top: 60px; }
          .sa-sidebar { transform: translateX(-100%); }
          .sa-sidebar.open { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

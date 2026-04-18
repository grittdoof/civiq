"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// ADMIN LAYOUT — Sidebar partagée pour tout /admin
// Exclut /admin/setup (onboarding sans sidebar)
// ═══════════════════════════════════════════════════

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Tableau de bord",
    icon: <LayoutDashboard size={18} />,
    exact: true,
  },
  {
    href: "/admin/surveys/new",
    label: "Nouveau sondage",
    icon: <PlusCircle size={18} />,
    exact: true,
  },
  {
    href: "/admin/profile",
    label: "Profil & paramètres",
    icon: <Settings size={18} />,
    exact: false,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [commune, setCommune] = useState<{ name: string; slug: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // La page /admin/setup n'a pas besoin de la sidebar
  const isSetup = pathname === "/admin/setup";

  useEffect(() => {
    if (isSetup) return;
    loadCommune();
  }, [isSetup]);

  async function loadCommune() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("communes(name, slug)")
      .eq("id", user.id)
      .single();

    if (profile?.communes) {
      setCommune(profile.communes as { name: string; slug: string });
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  // Pas de sidebar pour la page de setup
  if (isSetup) {
    return <>{children}</>;
  }

  return (
    <div className="al-root">
      {/* ── Mobile header ── */}
      <header className="al-mobile-header">
        <Link href="/admin/dashboard" className="al-mobile-logo">
          🏛 CiviQ
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="al-hamburger"
          aria-label="Menu"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* ── Overlay mobile ── */}
      {sidebarOpen && (
        <div
          className="al-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`al-sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Logo */}
        <div className="al-sidebar-logo">
          <Link href="/admin/dashboard" className="al-logo-link">
            <span className="al-logo-icon">🏛</span>
            <span className="al-logo-text">CiviQ</span>
          </Link>
        </div>

        {/* Commune badge */}
        {commune && (
          <div className="al-commune-badge">
            <div className="al-commune-dot" />
            <div>
              <strong>{commune.name}</strong>
              <span>/{commune.slug}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="al-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`al-nav-item ${isActive(item) ? "active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="al-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {isActive(item) && <ChevronRight size={14} className="al-nav-arrow" />}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="al-sidebar-bottom">
          {commune && (
            <a
              href={`/survey/besoins-periscolaires-2026?commune=${commune.slug}`}
              target="_blank"
              rel="noreferrer"
              className="al-preview-link"
            >
              👁 Voir le sondage en ligne
            </a>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="al-logout-btn"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="al-main">
        {children}
      </main>

      <style>{`
        .al-root {
          display: flex;
          min-height: 100vh;
          background: #f2efe8;
          font-family: 'Source Sans 3', -apple-system, sans-serif;
        }

        /* ── Sidebar ── */
        .al-sidebar {
          width: 240px;
          min-height: 100vh;
          background: #1a2744;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          z-index: 40;
          transition: transform 0.25s ease;
        }

        /* ── Logo ── */
        .al-sidebar-logo {
          padding: 24px 20px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .al-logo-link {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .al-logo-icon { font-size: 24px; }
        .al-logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #fff;
        }

        /* ── Commune badge ── */
        .al-commune-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 20px;
          background: rgba(255,255,255,0.05);
          margin: 12px 12px 4px;
          border-radius: 8px;
        }
        .al-commune-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4ade80;
          flex-shrink: 0;
        }
        .al-commune-badge strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          line-height: 1.2;
        }
        .al-commune-badge span {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          font-family: monospace;
        }

        /* ── Nav ── */
        .al-nav {
          flex: 1;
          padding: 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .al-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: rgba(255,255,255,0.6);
          font-size: 14px;
          font-weight: 500;
          transition: 0.15s;
          position: relative;
        }
        .al-nav-item:hover {
          background: rgba(255,255,255,0.07);
          color: #fff;
        }
        .al-nav-item.active {
          background: rgba(59,111,160,0.4);
          color: #fff;
        }
        .al-nav-icon { flex-shrink: 0; opacity: 0.8; }
        .al-nav-arrow {
          margin-left: auto;
          opacity: 0.5;
        }

        /* ── Bottom ── */
        .al-sidebar-bottom {
          padding: 16px 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .al-preview-link {
          display: block;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          transition: 0.15s;
        }
        .al-preview-link:hover {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.8);
        }
        .al-logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          background: none;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
          transition: 0.15s;
          font-family: inherit;
        }
        .al-logout-btn:hover {
          background: rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.8);
          border-color: rgba(255,255,255,0.2);
        }

        /* ── Main ── */
        .al-main {
          margin-left: 240px;
          flex: 1;
          min-width: 0;
        }

        /* ── Mobile ── */
        .al-mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: #1a2744;
          padding: 14px 20px;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        }
        .al-mobile-logo {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
        }
        .al-hamburger {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 4px;
          display: flex;
        }
        .al-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 35;
        }

        @media (max-width: 768px) {
          .al-mobile-header { display: flex; }
          .al-overlay { display: block; }
          .al-main { margin-left: 0; padding-top: 60px; }
          .al-sidebar {
            transform: translateX(-100%);
            top: 0;
            box-shadow: 4px 0 30px rgba(0,0,0,0.3);
          }
          .al-sidebar.open { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

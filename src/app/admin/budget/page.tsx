import { redirect } from "next/navigation";
import Link from "next/link";
import { PiggyBank, Plus, ArrowLeft } from "lucide-react";
import { isModuleActive } from "@/lib/module-guard";

// ═══════════════════════════════════════════════════════════════
// Page du module BUDGET PARTICIPATIF
//
// Montre le pattern "plug-and-play" :
//   1. Au début de la page, on vérifie que le module est activé
//      pour la commune via isModuleActive()
//   2. Sinon → redirect vers le dashboard avec un flag
//   3. Si actif → rendu normal
//
// Pour cloner ce module en un autre module :
//   - copier ce dossier sous /admin/<key>/
//   - remplacer "budget" par <key>
//   - créer src/modules/<key>/index.ts
// ═══════════════════════════════════════════════════════════════

export default async function BudgetPage() {
  const active = await isModuleActive("budget");
  if (!active) redirect("/admin/dashboard?module=budget&state=inactive");

  return (
    <main className="civiq-main">
      <Link
        href="/admin/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Tableau de bord
      </Link>

      <div className="civiq-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 className="civiq-page-title" style={{ margin: 0 }}>Budget participatif</h1>
            <span className="civiq-badge civiq-badge-warning">Beta</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Consultez vos administrés sur l&apos;allocation de votre budget d&apos;investissement.
          </p>
        </div>
        <Link href="/admin/budget/new" className="civiq-btn civiq-btn-default">
          <Plus size={15} /> Nouvelle enveloppe
        </Link>
      </div>

      <div className="civiq-card" style={{ textAlign: "center", padding: "56px 24px", borderStyle: "dashed" }}>
        <PiggyBank size={40} style={{ color: "var(--fg-xmuted)", margin: "0 auto 16px" }} strokeWidth={1.5} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>
          Aucune enveloppe active
        </h3>
        <p style={{ fontSize: 14, color: "var(--fg-muted)", marginBottom: 20 }}>
          Créez une enveloppe budgétaire pour collecter les priorités des citoyens.
        </p>
        <Link href="/admin/budget/new" className="civiq-btn civiq-btn-default">
          <Plus size={14} /> Créer une enveloppe
        </Link>
      </div>
    </main>
  );
}

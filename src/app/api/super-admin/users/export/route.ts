import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getAuthContext, isSuperAdmin } from "@/lib/auth-helpers";

// GET /api/super-admin/users/export — export CSV de tous les utilisateurs
// (ouvrable directement dans Excel / LibreOffice / Google Sheets)
export async function GET() {
  const ctx = await getAuthContext();
  if (!isSuperAdmin(ctx)) {
    return NextResponse.json({ error: "Réservé aux super-admins" }, { status: 403 });
  }

  const service = await createServiceClient();

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, job_title, created_at, communes(name, slug, code_postal)")
    .order("created_at", { ascending: false });

  const { data: { users: authUsers } } = await service.auth.admin.listUsers();

  const JOB_LABELS: Record<string, string> = {
    maire: "Maire",
    adjoint: "Adjoint au maire",
    conseiller: "Conseiller municipal",
    dgs: "Directeur Général des Services",
    secretaire: "Secrétaire de mairie",
    agent: "Agent territorial",
    citoyen: "Administré",
    autre: "Autre",
  };

  const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Administrateur",
    admin: "Administrateur",
    editor: "Éditeur",
    viewer: "Administré",
  };

  const rows = (profiles ?? []).map((p) => {
    const u = authUsers?.find((au) => au.id === p.id);
    const commune = p.communes as { name?: string; slug?: string; code_postal?: string } | null;
    return {
      "Nom complet": p.full_name || "",
      "Email": u?.email || "",
      "Rôle": ROLE_LABELS[p.role] || p.role || "",
      "Fonction": p.job_title ? JOB_LABELS[p.job_title] || p.job_title : "",
      "Commune": commune?.name || "",
      "Code postal": commune?.code_postal || "",
      "Slug commune": commune?.slug || "",
      "Inscrit le": new Date(p.created_at).toLocaleDateString("fr-FR"),
      "Dernière connexion": u?.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR") : "",
    };
  });

  const headers = Object.keys(rows[0] || {
    "Nom complet": "", "Email": "", "Rôle": "", "Fonction": "",
    "Commune": "", "Code postal": "", "Slug commune": "",
    "Inscrit le": "", "Dernière connexion": "",
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const csv = [
    headers.map(escape).join(";"),
    ...rows.map((row) => headers.map((h) => escape(String(row[h as keyof typeof row] ?? ""))).join(";")),
  ].join("\r\n");

  // BOM UTF-8 pour qu'Excel détecte l'encodage correctement
  const body = "\uFEFF" + csv;

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="civiq-utilisateurs-${date}.csv"`,
    },
  });
}

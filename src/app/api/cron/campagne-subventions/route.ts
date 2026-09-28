import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { cronAutorise } from "@/lib/aides/sync";
import { campagneActive } from "@/lib/aides/aides";
import { destinatairesCampagne, messageCampagne, projetsCampagne } from "@/lib/aides/campagne-server";
import { sendProjectNotification } from "@/lib/projects/push";
import { getSiteUrl, sendEmail } from "@/lib/email";
import { communeEmailShell, esc, paragraph } from "@/lib/emails/commune-shell";

// Cron mensuel (vercel.json, le 1er à 7 h). De septembre à décembre,
// pour chaque commune : investissements prévus l'année suivante sans
// demande de subvention déposée → push + email à l'élu référent de
// chaque projet et au maire. Une seule alerte par commune et par mois
// (table campagne_alertes).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = cronAutorise(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const now = new Date();
  if (!campagneActive(now) && request.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ skipped: "hors période de campagne (septembre à décembre)" });
  }
  const annee = now.getUTCFullYear() + 1;
  const periode = now.toISOString().slice(0, 7);
  const service = await createServiceClient();
  const siteUrl = getSiteUrl();

  const { data: modules } = await service.from("commune_modules").select("commune_id").eq("module_id", "projects");
  const resultats: Array<Record<string, unknown>> = [];

  for (const { commune_id } of modules ?? []) {
    const { data: deja } = await service
      .from("campagne_alertes").select("id").eq("commune_id", commune_id).eq("periode", periode).maybeSingle();
    if (deja) { resultats.push({ commune_id, skipped: "déjà envoyée ce mois-ci" }); continue; }

    const projets = await projetsCampagne(service, commune_id as string, annee);
    if (projets.length === 0) { resultats.push({ commune_id, projets: 0 }); continue; }

    const destinataires = await destinatairesCampagne(service, commune_id as string, projets.map((p) => p.id));
    const msg = messageCampagne(projets.length, annee);
    const url = `${siteUrl}/admin/projects?campagne=${annee}`;

    await sendProjectNotification({
      profileIds: destinataires,
      title: "Subventions : la campagne est ouverte",
      body: msg.constat,
      url: `/admin/projects?campagne=${annee}`,
      tag: `campagne-${periode}`,
      category: "project_financing",
    }).catch((e) => console.error("[campagne] push:", e));

    // Email (best effort, jamais bloquant).
    const [{ data: commune }, emails] = await Promise.all([
      service.from("communes").select("name, logo_url, address, code_postal, phone, contact_email, website_url").eq("id", commune_id).maybeSingle(),
      Promise.all(destinataires.map(async (id) => (await service.auth.admin.getUserById(id)).data.user?.email ?? null)),
    ]);
    const to = emails.filter((e): e is string => !!e);
    if (commune && to.length) {
      const rows = `
        <tr>
          <td style="padding:16px 32px 24px;">
            ${paragraph(`<strong>${esc(msg.constat)}</strong>`)}
            ${paragraph(esc(msg.consequence))}
            ${paragraph(`<ul style="margin:0; padding-left:20px;">${projets.map((p) => `<li>${esc(p.titre)}</li>`).join("")}</ul>`)}
            ${paragraph(`<a href="${esc(url)}" style="display:inline-block; background:#042f64; color:#fff; padding:12px 22px; border-radius:999px; text-decoration:none; font-weight:700;">Voir les projets concernés</a>`)}
            ${paragraph(`<span style="font-size:13px; color:#6b7080;">${esc(msg.enSavoirPlus[0])}</span>`)}
          </td>
        </tr>`;
      const html = communeEmailShell({
        siteUrl, commune: commune as never, eyebrow: "Campagne de subventions", title: `Projets prévus en ${annee}`,
        rows, footnote: "Alerte automatique GoCiviq — envoyée une fois par mois, de septembre à décembre.",
      });
      const text = [msg.constat, "", msg.consequence, "", ...projets.map((p) => `• ${p.titre}`), "", `Voir les projets : ${url}`].join("\n");
      const subject = `Subventions ${annee} : ${projets.length} projet${projets.length > 1 ? "s" : ""} sans demande déposée`;
      for (const email of to) {
        await sendEmail({ to: email, subject, html, text }).catch((e) => console.error("[campagne] email:", e));
      }
    }

    await service.from("campagne_alertes").insert({
      commune_id, periode, annee_cible: annee, projets: projets.map((p) => p.id), destinataires,
    });
    resultats.push({ commune_id, projets: projets.length, destinataires: destinataires.length });
  }

  return NextResponse.json({ periode, annee_cible: annee, resultats });
}

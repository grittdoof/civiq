import { createServiceClient } from "@/lib/supabase-server";
import { getSiteUrl, sendEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { buildSignalementConvertiEmail } from "@/lib/emails/signalement-converti";
import { notifyTicketTransformedToProject } from "@/lib/projects/push";
import { etatPasserelle, type EtatPasserelle } from "@/lib/projects/passerelle";
import { peutVoirProjet, contributeursConfidentiels, type Viewer } from "@/lib/projects/confidentialite";

// ═══════════════════════════════════════════════════════════════
// Passerelle signalement → projet (lot G) — accès serveur.
// ═══════════════════════════════════════════════════════════════

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Après création du projet : push à l'auteur du signalement ; email au
 * demandeur si demandé et si une adresse valide existe.
 * Renvoie true/false (email parti ou non), null si non demandé.
 * Ne lève jamais : la création du projet est déjà faite.
 */
export async function notifierConversion(opts: {
  ticketId: string;
  projectId: string;
  communeId: string;
  prevenirDemandeur: boolean;
}): Promise<boolean | null> {
  try {
    const service = await createServiceClient();
    const { data: t } = await service
      .from("tickets")
      .select("id, numero, titre, created_at, created_by, demandeur_nom, demandeur_email, commune:communes ( name, logo_url, address, code_postal, phone, contact_email, website_url )")
      .eq("id", opts.ticketId)
      .eq("commune_id", opts.communeId)
      .maybeSingle();
    if (!t) return opts.prevenirDemandeur ? false : null;

    await notifyTicketTransformedToProject({
      projectId: opts.projectId,
      ticketId: t.id,
      ticketNumero: t.numero,
      pilotes: [],
      ticketCreator: t.created_by,
    });

    if (!opts.prevenirDemandeur) return null;
    const email = (t.demandeur_email ?? "").trim();
    const commune = (Array.isArray(t.commune) ? t.commune[0] : t.commune) as { name: string; contact_email?: string | null } | null;
    if (!EMAIL_RE.test(email) || !commune) return false;

    const msg = buildSignalementConvertiEmail({
      siteUrl: getSiteUrl(),
      commune,
      demandeurNom: t.demandeur_nom,
      numero: t.numero,
      titre: t.titre,
      dateSignalement: t.created_at,
    });
    const res = await sendEmail({ to: email, subject: msg.subject, html: msg.html, text: msg.text, replyTo: commune.contact_email ?? undefined });
    await writeAudit({
      action: "ticket.converted_requester_notified",
      targetType: "ticket",
      targetId: t.id,
      communeId: opts.communeId,
      metadata: { project_id: opts.projectId, sent: res.sent },
    });
    if (res.sent) {
      await service.from("ticket_commentaires").insert({
        ticket_id: t.id, auteur_id: null, is_systeme: true,
        contenu: "Le demandeur a été informé par email de la conversion en projet.",
      });
    }
    return res.sent;
  } catch (e) {
    console.error("[passerelle] notifierConversion:", e);
    return opts.prevenirDemandeur ? false : null;
  }
}

/** État du lien vu par le spectateur (confidentialité appliquée). */
export async function chargerPasserelle(
  ticket: { statut: string; project_id: string | null },
  communeId: string,
  viewer: Viewer,
): Promise<EtatPasserelle> {
  if (!ticket.project_id) return etatPasserelle(ticket, null, false);
  const service = await createServiceClient();
  const { data: p } = await service
    .from("projects")
    .select("id, titre, deleted_at, confidentiel, pilote_elu, pilote_agent")
    .eq("id", ticket.project_id)
    .eq("commune_id", communeId)
    .maybeSingle();
  if (!p) return etatPasserelle({ ...ticket, project_id: null }, null, false);
  const contrib = await contributeursConfidentiels(service, [p]);
  return etatPasserelle(ticket, p, peutVoirProjet(viewer, p, contrib.get(p.id) ?? []));
}

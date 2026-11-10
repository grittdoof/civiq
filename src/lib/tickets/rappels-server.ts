// ═══════════════════════════════════════════════════════════════
// Tickets de rappel — accès serveur (service role).
//   • servicesParDefautRappel : service « Administration générale »
//   • declencherRappelsDus    : tâche quotidienne (cron)
//   • reprogrammerSiAnnuel    : à la clôture d'un rappel annuel
// ═══════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase-server";
import { sendEmail, getSiteUrl } from "@/lib/email";
import { communeEmailShell, esc, paragraph, panel, type EmailCommune } from "@/lib/emails/commune-shell";
import { sendTicketNotification } from "./push";
import { aujourdhuiParis, echeanceSuivante, estDu, formatJour, libelleAvance } from "./rappels";
import { nomAffichable } from "./documents-rapport";

type Service = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Catégorie et service d'un rappel : la catégorie « Administratif /
 * demande interne » et son service par défaut, à défaut le service
 * dont le nom commence par « Administration ».
 */
export async function reglagesParDefautRappel(service: Service, communeId: string): Promise<{ categorieId: string | null; serviceId: string | null }> {
  const [{ data: cat }, { data: services }] = await Promise.all([
    service.from("ticket_categories").select("id, service_defaut_id")
      .eq("commune_id", communeId).eq("code", "administratif").is("parent_id", null).is("deleted_at", null).maybeSingle(),
    service.from("services").select("id, nom").eq("commune_id", communeId).is("deleted_at", null),
  ]);
  const actifs = new Set((services ?? []).map((s) => s.id as string));
  const defaut = cat?.service_defaut_id && actifs.has(cat.service_defaut_id as string) ? (cat.service_defaut_id as string) : null;
  const parNom = (services ?? []).find((s) => /^administration/i.test((s.nom as string).normalize("NFD").replace(/[̀-ͯ]/g, "")));
  return { categorieId: (cat?.id as string | undefined) ?? null, serviceId: defaut ?? (parNom?.id as string | undefined) ?? null };
}

/** Membres d'un service (comptes équipe de la commune). */
export async function membresDuService(service: Service, serviceId: string | null): Promise<string[]> {
  if (!serviceId) return [];
  const { data } = await service.from("service_membres").select("profile_id").eq("service_id", serviceId);
  return (data ?? []).map((m) => m.profile_id as string);
}

/** Personnes prévenues par un rappel : auteur, assignés, destinataires. */
async function personnesAPrevenir(service: Service, t: { id: string; created_by: string | null; assigne_a: string | null }): Promise<string[]> {
  const [{ data: dest }, { data: assignes }] = await Promise.all([
    service.from("ticket_destinataires").select("profile_id").eq("ticket_id", t.id),
    service.from("ticket_assignees").select("profile_id").eq("ticket_id", t.id),
  ]);
  return [...new Set([
    t.created_by, t.assigne_a,
    ...(dest ?? []).map((d) => d.profile_id as string),
    ...(assignes ?? []).map((a) => a.profile_id as string),
  ].filter((x): x is string => !!x))];
}

interface TicketRappel {
  id: string; numero: number; titre: string; description: string | null; commune_id: string;
  statut: string; created_by: string | null; assigne_a: string | null;
  rappel_le: string | null; rappel_avance_jours: number; rappel_repetition: string; rappel_envoye_at: string | null;
  document_paths: string[] | null;
}

const COLONNES = "id, numero, titre, description, commune_id, statut, created_by, assigne_a, rappel_le, rappel_avance_jours, rappel_repetition, rappel_envoye_at, document_paths";

/** Email du rappel (charte de la commune). */
function emailRappel(t: TicketRappel, commune: EmailCommune, siteUrl: string): { subject: string; html: string; text: string } {
  const lien = `${siteUrl}/admin/tickets/${t.id}`;
  const echeance = formatJour(t.rappel_le!);
  const pieces = (t.document_paths ?? []).map(nomAffichable);
  const rows = [
    paragraph(`Vous avez programmé ce rappel : <strong>${esc(t.titre)}</strong>.`),
    panel("Échéance", `<p style="margin:0; font-size:15px; font-weight:700;">${esc(echeance)}</p>`),
    t.description ? panel("Note", `<p style="margin:0; white-space:pre-wrap;">${esc(t.description)}</p>`) : "",
    pieces.length ? panel("Pièces jointes dans le ticket", `<p style="margin:0;">${pieces.map(esc).join("<br>")}</p>`) : "",
    `<tr><td style="padding:8px 32px 24px; text-align:center;"><a href="${esc(lien)}" style="display:inline-block; background:#042f64; color:#fff; text-decoration:none; font-weight:700; padding:12px 24px; border-radius:999px;">Ouvrir le ticket n° ${t.numero}</a></td></tr>`,
  ].join("");
  return {
    subject: `Rappel : ${t.titre} — échéance le ${echeance}`,
    html: communeEmailShell({ siteUrl, commune, eyebrow: "Rappel programmé", title: t.titre, rows, footnote: "Rappel programmé dans GoCiviq." }),
    text: `Rappel : ${t.titre}\nÉchéance : ${echeance}\n${t.description ? `\n${t.description}\n` : ""}\nOuvrir le ticket : ${lien}`,
  };
}

/**
 * Tâche quotidienne : ouvre les rappels arrivés à leur date de
 * déclenchement et prévient les personnes (notification + email).
 */
export async function declencherRappelsDus(maintenant = new Date()): Promise<{ declenches: number; erreurs: number }> {
  const service = await createServiceClient();
  const aujourdhui = aujourdhuiParis(maintenant);
  const { data } = await service.from("tickets").select(COLONNES)
    .not("rappel_le", "is", null).is("rappel_envoye_at", null).eq("statut", "en_attente").limit(500);
  const dus = ((data ?? []) as TicketRappel[]).filter((t) => estDu(t, aujourdhui));
  let declenches = 0; let erreurs = 0;
  const communes = new Map<string, EmailCommune>();
  const siteUrl = getSiteUrl();

  for (const t of dus) {
    const { data: maj, error } = await service.from("tickets")
      .update({ statut: t.assigne_a ? "assigne" : "nouveau", rappel_envoye_at: maintenant.toISOString() })
      .eq("id", t.id).is("rappel_envoye_at", null).select("id");
    if (error || !maj?.length) { if (error) { erreurs += 1; console.error("[rappels]", t.id, error); } continue; }
    declenches += 1;
    await service.from("ticket_commentaires").insert({
      ticket_id: t.id, auteur_id: null, is_systeme: true,
      contenu: `Rappel déclenché (échéance le ${formatJour(t.rappel_le!)}, ${libelleAvance(t.rappel_avance_jours).toLowerCase()}).`,
    });

    const personnes = await personnesAPrevenir(service, t);
    if (personnes.length === 0) continue;
    sendTicketNotification({
      profileIds: personnes,
      title: `Rappel : ${t.titre}`,
      body: `Échéance le ${formatJour(t.rappel_le!)}`,
      url: `/admin/tickets/${t.id}`,
      tag: `ticket-${t.id}`,
    }).catch((e) => console.error("[rappels] push:", e));

    if (!communes.has(t.commune_id)) {
      const { data: c } = await service.from("communes")
        .select("name, logo_url, address, code_postal, phone, contact_email, website_url").eq("id", t.commune_id).maybeSingle();
      communes.set(t.commune_id, (c ?? { name: "Mairie" }) as EmailCommune);
    }
    const emails = (await Promise.all(personnes.map(async (id) => {
      const { data: u } = await service.auth.admin.getUserById(id);
      return u?.user?.email ?? null;
    }))).filter((e): e is string => !!e);
    if (emails.length > 0) {
      const commune = communes.get(t.commune_id)!;
      const m = emailRappel(t, commune, siteUrl);
      const r = await sendEmail({ to: emails, subject: m.subject, html: m.html, text: m.text, replyTo: commune.contact_email ?? undefined });
      if (!r.sent && r.error !== "email_not_configured") console.error("[rappels] email:", t.id, r.error);
    }
  }
  return { declenches, erreurs };
}

/**
 * À la clôture d'un rappel annuel : crée le rappel de l'année suivante
 * (mêmes titre, note, service, visibilité, personnes et pièces jointes).
 * Ne fait rien si ce n'est pas un rappel annuel ou s'il existe déjà.
 */
export async function reprogrammerSiAnnuel(service: Service, ticketId: string): Promise<string | null> {
  const { data } = await service.from("tickets")
    .select(`${COLONNES}, categorie_id, service_id, confidentialite, canal`).eq("id", ticketId).maybeSingle();
  const t = data as (TicketRappel & { categorie_id: string | null; service_id: string | null; confidentialite: string; canal: string }) | null;
  if (!t || !t.rappel_le || t.rappel_repetition !== "annuelle") return null;
  const { data: deja } = await service.from("tickets").select("id").eq("rappel_origine_id", t.id).limit(1);
  if ((deja ?? []).length > 0) return null;

  const echeance = echeanceSuivante(t.rappel_le, aujourdhuiParis());
  const { data: cree, error } = await service.from("tickets").insert({
    commune_id: t.commune_id, created_by: t.created_by, canal: t.canal, titre: t.titre, description: t.description,
    categorie_id: t.categorie_id, service_id: t.service_id, confidentialite: t.confidentialite,
    urgence: "normale", statut: "en_attente", assigne_a: t.assigne_a, assigne_at: t.assigne_a ? new Date().toISOString() : null,
    rappel_le: echeance, rappel_avance_jours: t.rappel_avance_jours, rappel_repetition: "annuelle",
    rappel_origine_id: t.id, document_paths: t.document_paths,
  }).select("id, numero").single();
  if (error || !cree) { console.error("[rappels] reprogrammation:", error); return null; }

  const [{ data: dest }, { data: assignes }] = await Promise.all([
    service.from("ticket_destinataires").select("profile_id, ajoute_par").eq("ticket_id", t.id),
    service.from("ticket_assignees").select("profile_id, assigned_by").eq("ticket_id", t.id),
  ]);
  if (dest?.length) await service.from("ticket_destinataires").insert(dest.map((d) => ({ ticket_id: cree.id, profile_id: d.profile_id, ajoute_par: d.ajoute_par })));
  if (assignes?.length) await service.from("ticket_assignees").insert(assignes.map((a) => ({ ticket_id: cree.id, profile_id: a.profile_id, assigned_by: a.assigned_by })));
  await service.from("ticket_commentaires").insert({
    ticket_id: t.id, auteur_id: null, is_systeme: true,
    contenu: `Rappel de l'année suivante programmé : ticket n° ${cree.numero}, échéance le ${formatJour(echeance)}.`,
  });
  return cree.id as string;
}

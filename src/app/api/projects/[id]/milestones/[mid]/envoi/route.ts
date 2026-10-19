import { NextRequest, NextResponse } from "next/server";
import { requireProjectEdit } from "@/lib/projects/api-helpers";
import { createServiceClient } from "@/lib/supabase-server";
import { writeAudit } from "@/lib/audit";
import { getSiteUrl, sendEmail, type EmailAttachment } from "@/lib/email";
import { communeEmailShell, esc, paragraph, type EmailCommune } from "@/lib/emails/commune-shell";
import { ETAPE_STATUT_META, statutOf } from "@/lib/projects/etapes";
import { copieSans } from "@/lib/projects/copie";
import { FONCTION_LABEL, groupeDe } from "@/lib/profils/fonctions";
import { copiePour } from "@/lib/projects/copie-server";
import {
  MAX_DESTINATAIRES, MAX_PIECES_OCTETS, messageEtape, messageVersHtml, validerDestinataires,
} from "@/lib/projects/envoi-etape";

// ═══════════════════════════════════════════════════════════════
// GET  /api/projects/:id/milestones/:mid/envoi — préparation : message
//      prérédigé, destinataires suggérés, pièces jointes, historique.
// POST /api/projects/:id/milestones/:mid/envoi — envoi :
//      { destinataires, objet, message, documents, copie_moi }
// Réponse à l'expéditeur (reply_to). Jamais de pièce « note interne ».
// ═══════════════════════════════════════════════════════════════

interface RouteParams { params: Promise<{ id: string; mid: string }> }
type Service = Awaited<ReturnType<typeof createServiceClient>>;

interface Suggestion { email: string; label: string; source: "etape" | "projet" | "equipe" | "mairie" | "historique" }

async function charger(service: Service, projectId: string, mid: string, communeId: string, userId: string) {
  const [{ data: projet }, { data: etape }, { data: liens }, { data: docs }, { data: commune }, { data: moi }, { data: envois }] =
    await Promise.all([
      service.from("projects").select("id, titre, commission_pilote_id, pilote_elu, pilote_agent").eq("id", projectId).maybeSingle(),
      service.from("milestones")
        .select("id, libelle, statut, fait, echeance, date_previsionnelle, commentaire, commentaire_note_interne")
        .eq("id", mid).eq("project_id", projectId).is("deleted_at", null).maybeSingle(),
      service.from("milestone_contacts").select("contact:contacts!inner ( nom, organisation, email, telephone, deleted_at )").eq("milestone_id", mid),
      service.from("project_documents").select("id, nom, storage_path, note_interne")
        .eq("project_id", projectId).eq("milestone_id", mid).is("deleted_at", null),
      service.from("communes").select("name, logo_url, address, code_postal, phone, contact_email, website_url").eq("id", communeId).maybeSingle(),
      service.from("profiles").select("full_name, job_title").eq("id", userId).maybeSingle(),
      service.from("milestone_envois").select("created_at, destinataires, envoye_par, envoye").eq("milestone_id", mid).order("created_at", { ascending: false }).limit(10),
    ]);
  let commission: string | null = null;
  if (projet?.commission_pilote_id) {
    const { data } = await service.from("commissions").select("nom").eq("id", projet.commission_pilote_id).maybeSingle();
    commission = (data?.nom as string | null) ?? null;
  }
  const contacts = (liens ?? [])
    .map((l) => (Array.isArray(l.contact) ? l.contact[0] : l.contact) as { nom: string; organisation: string | null; email: string | null; telephone: string | null; deleted_at: string | null } | null)
    .filter((c): c is NonNullable<typeof c> => !!c && !c.deleted_at);
  const pieces = (docs ?? []).filter((d) => !d.note_interne && d.storage_path);
  return { projet, etape, contacts, pieces, commune: commune as EmailCommune | null, moi, envois: envois ?? [], commission };
}

async function emailDe(service: Service, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await service.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;
  const service = await createServiceClient();
  const d = await charger(service, id, mid, access.communeId, access.userId);
  if (!d.projet || !d.etape || !d.commune) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });

  const { objet, message } = messageEtape({
    projet: { titre: d.projet.titre, commission: d.commission },
    etape: { ...d.etape, statutLibelle: ETAPE_STATUT_META[statutOf(d.etape)].label },
    contacts: d.contacts,
    pieces: d.pieces.map((p) => p.nom),
    expediteur: { nom: (d.moi?.full_name as string | null) ?? null, fonction: (d.moi?.job_title as string | null) ?? null },
    commune: d.commune.name,
  });

  // Suggestions : parties prenantes de l'étape, derniers destinataires,
  // élu référent / agent pilote, adresse de la mairie.
  const suggestions: Suggestion[] = [];
  const ajouter = (email: string | null | undefined, label: string, source: Suggestion["source"]) => {
    const e = (email ?? "").trim().toLowerCase();
    if (e && !suggestions.some((s) => s.email === e)) suggestions.push({ email: e, label, source });
  };
  for (const c of d.contacts) ajouter(c.email, c.organisation ? `${c.nom} (${c.organisation})` : c.nom, "etape");
  for (const e of d.envois) if (e.envoye !== false) for (const x of (e.destinataires as string[]) ?? []) ajouter(x, x, "historique");
  const equipe = [d.projet.pilote_elu, d.projet.pilote_agent].filter((x): x is string => !!x && x !== access.userId);
  if (equipe.length) {
    const { data: profs } = await service.from("profiles").select("id, full_name").in("id", equipe);
    for (const pr of profs ?? []) ajouter(await emailDe(service, pr.id as string), (pr.full_name as string | null) ?? "Membre de l'équipe", "equipe");
  }
  ajouter(d.commune.contact_email, `Mairie de ${d.commune.name}`, "mairie");

  const noms = new Map<string, string>();
  const auteurs = [...new Set(d.envois.map((e) => e.envoye_par as string | null).filter((x): x is string => !!x))];
  if (auteurs.length) {
    const { data } = await service.from("profiles").select("id, full_name").in("id", auteurs);
    for (const pr of data ?? []) noms.set(pr.id as string, (pr.full_name as string | null) ?? "");
  }

  // Utilisateurs de la commune (élus, services), classés par groupe de fonction.
  const { data: profs } = await service
    .from("profiles")
    .select("id, full_name, job_title, role")
    .eq("commune_id", access.communeId)
    .in("role", ["admin", "editor"])
    .neq("id", access.userId)
    .order("full_name");
  const utilisateurs = (await Promise.all((profs ?? []).map(async (pr) => {
    const email = await emailDe(service, pr.id as string);
    if (!email) return null;
    return {
      email: email.toLowerCase(),
      nom: (pr.full_name as string | null) ?? email,
      fonction: FONCTION_LABEL[pr.job_title as string] ?? null,
      groupe: groupeDe(pr.job_title as string | null),
    };
  }))).filter((u): u is NonNullable<typeof u> => !!u);

  return NextResponse.json({
    objet,
    message,
    utilisateurs,
    suggestions,
    // Présélection : les parties prenantes de l'étape (envoi en un clic).
    preselection: suggestions.filter((s) => s.source === "etape").map((s) => s.email),
    pieces: d.pieces.map((p) => ({ id: p.id, nom: p.nom })),
    historique: d.envois.map((e) => ({ le: e.created_at, destinataires: e.destinataires, par: noms.get(e.envoye_par as string) ?? null, envoye: e.envoye !== false })),
    expediteur: await emailDe(service, access.userId),
    // Secrétariat en copie (liste de la commission pilote, sinon de la commune).
    copieSecretariat: await copiePour(service, access.communeId, d.projet.commission_pilote_id),
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id, mid } = await params;
  const access = await requireProjectEdit(id);
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => ({}))) as {
    destinataires?: unknown; objet?: unknown; message?: unknown; documents?: unknown; copie_moi?: unknown;
    copie_secretariat?: unknown;
  };
  const { valides, invalides } = validerDestinataires(body.destinataires);
  if (invalides.length) return NextResponse.json({ error: `Adresse invalide : ${invalides.join(", ")}` }, { status: 400 });
  if (valides.length === 0) return NextResponse.json({ error: "Choisissez au moins un destinataire." }, { status: 400 });
  if (valides.length > MAX_DESTINATAIRES) return NextResponse.json({ error: `${MAX_DESTINATAIRES} destinataires au maximum.` }, { status: 400 });
  const objet = typeof body.objet === "string" ? body.objet.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 10000) : "";
  if (!objet || !message) return NextResponse.json({ error: "L'objet et le message sont obligatoires." }, { status: 400 });
  const voulus = new Set(Array.isArray(body.documents) ? body.documents.filter((x): x is string => typeof x === "string") : []);

  const service = await createServiceClient();
  const d = await charger(service, id, mid, access.communeId, access.userId);
  if (!d.projet || !d.etape || !d.commune) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });

  // Pièces jointes : seulement celles de l'étape, jamais une note interne.
  const attachments: EmailAttachment[] = [];
  let total = 0;
  for (const p of d.pieces.filter((x) => voulus.has(x.id))) {
    const { data: blob, error } = await service.storage.from("project-documents").download(p.storage_path as string);
    if (error || !blob) return NextResponse.json({ error: `La pièce « ${p.nom} » est introuvable.` }, { status: 500 });
    const content = Buffer.from(await blob.arrayBuffer());
    total += content.length;
    if (total > MAX_PIECES_OCTETS) return NextResponse.json({ error: "Pièces jointes trop lourdes (20 Mo au total au maximum)." }, { status: 413 });
    attachments.push({ filename: p.nom, content });
  }

  const expediteur = await emailDe(service, access.userId);
  const copieMoi = body.copie_moi === true && expediteur ? [expediteur.toLowerCase()] : [];
  const secretariat = body.copie_secretariat === true
    ? await copiePour(service, access.communeId, d.projet.commission_pilote_id)
    : [];
  const copie = copieSans([...new Set([...copieMoi, ...secretariat])], valides);
  const html = communeEmailShell({
    siteUrl: getSiteUrl(),
    commune: d.commune,
    eyebrow: "Mission confiée",
    title: d.etape.libelle,
    rows: `<tr><td style="padding:12px 32px 28px;">${messageVersHtml(message, esc, paragraph)}</td></tr>`,
    footnote: `Message envoyé depuis GoCiviq pour la mairie de ${d.commune.name}. Répondez directement à cet email.`,
  });

  const res = await sendEmail({
    to: valides,
    cc: copie,
    subject: objet,
    html,
    text: message,
    replyTo: expediteur ?? d.commune.contact_email ?? undefined,
    attachments,
  });

  await service.from("milestone_envois").insert({
    project_id: id,
    milestone_id: mid,
    envoye_par: access.userId,
    destinataires: valides,
    copie,
    objet,
    pieces_jointes: attachments.map((a) => a.filename),
    envoye: res.sent,
  });
  await writeAudit({
    action: "milestone.sent_by_email",
    targetType: "milestone",
    targetId: mid,
    communeId: access.communeId,
    metadata: { project_id: id, destinataires: valides.length, pieces: attachments.length, sent: res.sent },
  });

  if (!res.sent) {
    return NextResponse.json(
      { error: res.error === "email_not_configured" ? "L'envoi d'emails n'est pas configuré sur la plateforme." : "L'email n'est pas parti. Réessayez dans un instant." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, destinataires: valides });
}

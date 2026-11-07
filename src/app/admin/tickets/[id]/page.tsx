import { notFound, redirect } from "next/navigation";
import Link from "next/link";
// Le composant a "use client" + chargement Leaflet en useEffect :
// le SSR ne touche pas Leaflet, pas besoin de next/dynamic ssr:false.
import TicketLocationMap from "@/components/tickets/TicketLocationMap";
import {
  ArrowLeft, MapPin, User as UserIcon, Calendar, Phone, Mail, Clock,
  Tag, Hash, Inbox, FileText,
} from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { getTicket, getRapportDocuments } from "@/lib/tickets/queries";
import { urlPhoto } from "@/lib/tickets/pieces";
import PhotoGallery, { type PhotoGalerie } from "@/components/tickets/PhotoGallery";
import TicketVisibilite from "@/components/tickets/TicketVisibilite";
import { chargerSpectateur, journalDesAcces, journaliserConsultation } from "@/lib/tickets/droits-server";
import { listerPersonnesCommune } from "@/lib/tickets/mutations";
import { createServiceClient } from "@/lib/supabase-server";
import { estSensible } from "@/lib/tickets/droits";
import { Lock } from "lucide-react";
import { listAssignableAgents } from "@/lib/tickets/mutations";
import { isModuleActive } from "@/lib/module-guard";
import { PrioriteBadge, StatutBadge, CategorieBadge } from "@/components/tickets/TicketBadge";
import {
  CANAL_LABELS, type TicketCommentaire,
} from "@/lib/tickets/types";
import TicketsRealtime from "@/components/tickets/TicketsRealtime";
import TicketActions from "@/components/tickets/TicketActions";
import TicketMobileActions from "@/components/tickets/TicketMobileActions";
import TicketCommentForm from "@/components/tickets/TicketCommentForm";
import TransformTicketButton from "@/components/projects/TransformTicketButton";
import { chargerPasserelle } from "@/lib/projects/passerelle-server";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/[id] — Détail interactif (Session 3)
// • Panel d'actions contextuelles (transitions de statut, prio,
//   assignation)
// • Wizard de clôture sous /cloturer
// • Ajout de commentaires libres dans la timeline
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const { id } = await params;
  const spectateur = await chargerSpectateur();
  const [{ ticket, photos, commentaires, rapport, assignees, destinataires, droits }, agents] = await Promise.all([
    getTicket(ctx.communeId, id, spectateur),
    listAssignableAgents(),
  ]);
  if (!ticket || !droits || !spectateur) notFound();

  // Droits de cette personne sur ce signalement (matrice de la commune, lot 1)
  const isSuperAdmin = ctx.role === "super_admin";
  const isAdmin = ctx.role === "admin";
  const isEditor = ctx.role === "editor";
  const canEdit = droits.modifier;
  const canAssign = droits.assigner;
  const canComment = droits.commenter;
  const niveau = ticket.confidentialite ?? "standard";
  const sensible = estSensible(ticket);
  if (sensible) await journaliserConsultation(ticket, spectateur);

  // Services de la commune, personnes nommables, journal des accès
  const service = await createServiceClient();
  const [{ data: servicesRows }, personnes, acces] = await Promise.all([
    service.from("services").select("id, nom").eq("commune_id", ticket.commune_id).is("deleted_at", null).order("ordre").order("nom"),
    droits.changer_visibilite ? listerPersonnesCommune() : Promise.resolve([]),
    sensible ? journalDesAcces(ticket.id) : Promise.resolve([]),
  ]);
  const projectId = (ticket as { project_id?: string | null }).project_id ?? null;
  // Passerelle projet : réservée à l'équipe, module Projets actif.
  const passerelle = (isSuperAdmin || isAdmin || isEditor) && (await isModuleActive("projects"))
    ? await chargerPasserelle({ statut: ticket.statut, project_id: projectId }, ctx.communeId!, { id: ctx.userId, role: ctx.role })
    : null;

  // Pièces jointes : adresses stables de nos routes (droits vérifiés à
  // l'ouverture, jamais de lien signé périmé dans une page restée ouverte).
  const versGalerie = (p: (typeof photos)[number]): PhotoGalerie => ({
    id: p.id,
    src: urlPhoto(ticket.id, p.id),
    miniature: urlPhoto(ticket.id, p.id, { miniature: true }),
    telecharger: urlPhoto(ticket.id, p.id, { telecharger: true }),
    legende: p.legende,
    date: new Date(p.uploaded_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  });
  const signalementPhotos = photos.filter((p) => p.type === "signalement").map(versGalerie);
  const serviceFaitPhotos = photos.filter((p) => p.type === "service_fait").map(versGalerie);
  const rapportDocuments = await getRapportDocuments(ticket.commune_id, ticket.id, rapport?.document_paths);

  const dateFormat = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <main className="civiq-main tk-detail-with-mobile-cta">
      <Link href="/admin/tickets" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-muted)", textDecoration: "none", marginBottom: 16 }}>
        <ArrowLeft size={14} /> Tickets
      </Link>

      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {niveau !== "standard" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--marine)", color: "#fff" }}>
              <Lock size={12} aria-hidden="true" /> {niveau === "restreint" ? "Restreint" : "Confidentiel"}
            </span>
          )}
          <PrioriteBadge priorite={ticket.priorite} />
          <CategorieBadge categorie={ticket.categorie} />
          <StatutBadge statut={ticket.statut} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, color: "var(--fg-xmuted)", marginRight: 10 }}>
            #{ticket.numero}
          </span>
          {ticket.titre}
        </h1>
      </header>

      <div className="tk-detail-grid">
        {/* Colonne gauche : contenu */}
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Photos signalement */}
          {signalementPhotos.length > 0 && (
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
                Photos du signalement
              </h2>
              <PhotoGallery photos={signalementPhotos} titre="Photos du signalement" />
            </div>
          )}

          {/* Description */}
          {ticket.description && (
            <div className="civiq-card" style={{ padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
                Description
              </h2>
              <p style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {ticket.description}
              </p>
            </div>
          )}

          {/* Localisation */}
          {(ticket.adresse || (ticket.latitude && ticket.longitude)) && (
            <div className="civiq-card" style={{ padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 10 }}>
                Localisation
              </h2>
              {ticket.adresse && (
                <p style={{ fontSize: 14, color: "var(--fg)", display: "flex", gap: 6, alignItems: "flex-start", lineHeight: 1.5, marginBottom: 6 }}>
                  <MapPin size={15} style={{ marginTop: 2, color: "var(--fg-muted)", flexShrink: 0 }} />
                  {ticket.adresse}
                </p>
              )}
              {ticket.latitude && ticket.longitude && (
                <>
                  <p style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 12, fontFamily: "ui-monospace, monospace" }}>
                    {ticket.latitude.toFixed(5)}, {ticket.longitude.toFixed(5)}
                    {ticket.precision_geo && <span style={{ marginLeft: 8 }}>· {ticket.precision_geo}</span>}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${ticket.latitude},${ticket.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginLeft: 10, color: "var(--accent)", textDecoration: "none", fontFamily: "inherit", fontWeight: 600 }}
                    >
                      Itinéraire ↗
                    </a>
                  </p>
                  <TicketLocationMap
                    lat={ticket.latitude}
                    lng={ticket.longitude}
                    priorite={ticket.priorite}
                    label={ticket.adresse ?? ticket.titre}
                    height={260}
                  />
                </>
              )}
            </div>
          )}

          {/* Demandeur (si signalement externe) */}
          {(ticket.demandeur_nom || ticket.demandeur_telephone || ticket.demandeur_email) && (
            <div className="civiq-card" style={{ padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
                Demandeur
              </h2>
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {ticket.demandeur_nom && <div style={{ display: "flex", gap: 6, alignItems: "center" }}><UserIcon size={13} style={{ color: "var(--fg-muted)" }} /> {ticket.demandeur_nom}</div>}
                {ticket.demandeur_telephone && <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Phone size={13} style={{ color: "var(--fg-muted)" }} /> <a href={`tel:${ticket.demandeur_telephone}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{ticket.demandeur_telephone}</a></div>}
                {ticket.demandeur_email && <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Mail size={13} style={{ color: "var(--fg-muted)" }} /> <a href={`mailto:${ticket.demandeur_email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{ticket.demandeur_email}</a></div>}
                {ticket.demandeur_adresse && <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><MapPin size={13} style={{ marginTop: 2, color: "var(--fg-muted)" }} /> {ticket.demandeur_adresse}</div>}
              </div>
            </div>
          )}

          {/* Photos service fait */}
          {serviceFaitPhotos.length > 0 && (
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--success)", marginBottom: 8 }}>
                Service fait
              </h2>
              <PhotoGallery photos={serviceFaitPhotos} titre="Photos du service fait" />
            </div>
          )}

          {/* Rapport d'intervention */}
          {rapport && (
            <div className="civiq-card" style={{ padding: 16, borderColor: "var(--success)" }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--success)", marginBottom: 8 }}>
                Rapport d&apos;intervention
              </h2>
              <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                {rapport.description_intervention && (
                  <p style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{rapport.description_intervention}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  {rapport.duree_minutes != null && (
                    <div><strong style={{ color: "var(--fg-muted)", fontSize: 11, fontWeight: 600 }}>Durée :</strong><br />{rapport.duree_minutes} min</div>
                  )}
                  {rapport.materiaux_utilises && (
                    <div><strong style={{ color: "var(--fg-muted)", fontSize: 11, fontWeight: 600 }}>Matériaux :</strong><br />{rapport.materiaux_utilises}</div>
                  )}
                  {rapport.cout_estime != null && (
                    <div><strong style={{ color: "var(--fg-muted)", fontSize: 11, fontWeight: 600 }}>Coût :</strong><br />{rapport.cout_estime.toLocaleString("fr-FR")} €</div>
                  )}
                </div>
                {rapportDocuments.length > 0 && (
                  <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                    <strong style={{ color: "var(--fg-muted)", fontSize: 11, fontWeight: 600 }}>
                      Pièce{rapportDocuments.length > 1 ? "s" : ""} jointe{rapportDocuments.length > 1 ? "s" : ""} :
                    </strong>
                    <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 4 }}>
                      {rapportDocuments.map((d) => (
                        <li key={d.path} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <FileText size={14} aria-hidden="true" style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                          {d.url ? (
                            <>
                              {d.ouvrir ? (
                                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", wordBreak: "break-all" }}>
                                  {d.nom} <span className="tk-sr-only">(s&apos;ouvre dans un nouvel onglet)</span>
                                </a>
                              ) : (
                                <a href={d.telechargement} style={{ color: "var(--accent)", wordBreak: "break-all" }}>
                                  {d.nom}
                                </a>
                              )}
                              <a href={d.telechargement} aria-label={`Télécharger ${d.nom}`} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                                Télécharger
                              </a>
                            </>
                          ) : (
                            <span style={{ color: "var(--fg-muted)" }}>{d.nom} (fichier introuvable)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rapport.necessite_suivi && rapport.notes_suivi && (
                  <div style={{ marginTop: 8, padding: 10, background: "var(--accent-light)", borderRadius: 6, fontSize: 12 }}>
                    <strong>Suivi nécessaire :</strong> {rapport.notes_suivi}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 12 }}>
              Journal d&apos;activité
            </h2>
            {commentaires.length > 0 ? (
              <Timeline items={commentaires} />
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-muted)", fontStyle: "italic" }}>
                Aucune activité enregistrée pour le moment.
              </p>
            )}
            {canComment && <TicketCommentForm ticketId={ticket.id} />}
          </div>
        </section>

        {/* Colonne droite : panel d'actions + infos */}
        <aside className="tk-detail-aside-desktop">
          <TicketActions
            ticketId={ticket.id}
            ticketNumero={ticket.numero}
            statut={ticket.statut}
            priorite={ticket.priorite}
            assigneId={ticket.assigne_a}
            assigneeName={ticket.assignee_profile?.full_name ?? null}
            assigneeIds={assignees.map((a) => a.id)}
            assigneeProfiles={assignees.map((a) => ({ id: a.id, full_name: a.full_name }))}
            isSuperAdmin={isSuperAdmin}
            canEdit={canEdit}
            canClose={droits.cloturer}
            canReopen={droits.rouvrir}
            canAssign={canAssign}
            agents={agents}
            hasReport={!!rapport}
            verrouParProjet={!!projectId}
          />

          <TicketVisibilite
            ticketId={ticket.id}
            serviceId={ticket.service_id ?? null}
            services={(servicesRows ?? []) as Array<{ id: string; nom: string }>}
            niveau={niveau}
            destinataires={destinataires}
            personnes={personnes}
            moi={ctx.userId}
            peutChangerService={droits.changer_service}
            peutChangerVisibilite={droits.changer_visibilite}
          />

          {sensible && (
            <div className="civiq-card" style={{ padding: 14 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
                Journal des accès
              </h2>
              {acces.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: 0 }}>Aucun accès enregistré.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, fontSize: 12.5 }}>
                  {acces.map((a) => (
                    <li key={a.id}>
                      <strong>{a.qui ?? "Compte supprimé"}</strong>{" "}
                      {a.action === "ticket.consultation" ? "a consulté" : `a modifié${a.quoi ? ` (${a.quoi})` : ""}`}
                      <span style={{ color: "var(--fg-muted)" }}> · {new Date(a.quand).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Lien vers le module Gestion de projet (commit 12) */}
          {passerelle && (
            <div className="civiq-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)" }}>
                Projet
              </h2>
              <TransformTicketButton ticketId={ticket.id} etat={passerelle} />
            </div>
          )}

          <div className="civiq-card" style={{ padding: 14 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
              Détails
            </h2>
            <div style={{ display: "grid", gap: 8, fontSize: 12.5 }}>
              <KV icon={<Hash size={12} />} label="Numéro" value={`#${ticket.numero}`} mono />
              <KV icon={<Inbox size={12} />} label="Canal" value={CANAL_LABELS[ticket.canal]} />
              <KV icon={<Tag size={12} />} label="Catégorie" value={ticket.categorie.replace("_", " ")} />
              <KV icon={<Calendar size={12} />} label="Créé le" value={dateFormat(ticket.created_at)} />
              {ticket.assigne_at && <KV icon={<Clock size={12} />} label="Assigné le" value={dateFormat(ticket.assigne_at)} />}
              {ticket.pris_en_charge_at && <KV icon={<Clock size={12} />} label="Pris en charge" value={dateFormat(ticket.pris_en_charge_at)} />}
              {ticket.resolu_at && <KV icon={<Clock size={12} />} label="Résolu le" value={dateFormat(ticket.resolu_at)} />}
              {ticket.clos_at && <KV icon={<Clock size={12} />} label="Clos le" value={dateFormat(ticket.clos_at)} />}
              {ticket.echeance && <KV icon={<Calendar size={12} />} label="Échéance" value={new Date(ticket.echeance).toLocaleDateString("fr-FR")} />}
            </div>
          </div>

          {ticket.created_by_profile && (
            <div className="civiq-card" style={{ padding: 14 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 8 }}>
                Saisi par
              </h2>
              <div style={{ fontSize: 13 }}>
                {ticket.created_by_profile.full_name ?? "Utilisateur supprimé"}
                {ticket.created_by_profile.job_title && (
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", textTransform: "capitalize" }}>{ticket.created_by_profile.job_title.replace("_", " ")}</div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      <TicketMobileActions
        ticketId={ticket.id}
        ticketNumero={ticket.numero}
        statut={ticket.statut}
        canEdit={canEdit}
        canClose={droits.cloturer}
        canReopen={droits.rouvrir}
        isSuperAdmin={isSuperAdmin}
        hasReport={!!rapport}
        verrouParProjet={!!projectId}
      />

      <TicketsRealtime communeId={ctx.communeId!} ticketId={ticket.id} />
    </main>
  );
}

function KV({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
      <span style={{ color: "var(--fg-muted)", marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--fg-muted)", fontSize: 11, fontWeight: 500 }}>{label}</div>
        <div style={{ color: "var(--fg)", fontFamily: mono ? "ui-monospace, monospace" : undefined }}>{value}</div>
      </div>
    </div>
  );
}

function Timeline({ items }: { items: TicketCommentaire[] }) {
  return (
    <div className="tk-timeline">
      {items.map((c) => (
        <div key={c.id} className="tk-timeline-item">
          <span className={`tk-timeline-dot${c.is_systeme ? " system" : ""}`} aria-hidden />
          <div className="tk-timeline-content">
            <div className="tk-timeline-meta">
              <span>{c.is_systeme ? "Système" : "Commentaire"}</span>
              <span>·</span>
              <span>{new Date(c.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p>{c.contenu}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

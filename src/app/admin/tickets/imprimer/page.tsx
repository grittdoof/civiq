import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { createServiceClient } from "@/lib/supabase-server";
import { listTickets, getPhotoSignedUrl } from "@/lib/tickets/queries";
import {
  CANAL_LABELS,
  CATEGORIE_LABELS,
  CATEGORIE_ICONS,
  PRIORITE_LABELS,
  STATUT_LABELS,
  GROUP_LABELS,
  OUVERT_STATUTS,
  CLOTURE_STATUTS,
  groupOf,
} from "@/lib/tickets/types";
import PrintAutoTrigger from "./PrintAutoTrigger";
import PrintButton from "./PrintButton";

// ═══════════════════════════════════════════════════════════════
// /admin/tickets/imprimer — Page synthétique imprimable / PDF.
//
// Rendu Server Component avec mise en page optimisée print + écran.
// L'utilisateur fait Ctrl/⌘ + P pour générer un PDF.
// Une option ?auto=1 déclenche automatiquement la boîte d'impression
// (utilisé quand on arrive via le bouton "Imprimer" depuis la liste).
//
// Filtres URL : ?filter=ouverts|cloture|tous (par défaut tous)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ filter?: string; auto?: string }>;
}

export default async function PrintTicketsPage({ searchParams }: Props) {
  const ctx = await requireCommune();
  if (!ctx.communeId) redirect("/admin/onboarding");
  if (ctx.role !== "super_admin") {
    const active = await isModuleActive("tickets");
    if (!active) redirect("/admin/dashboard?module=tickets&state=inactive");
  }

  const { filter = "tous", auto } = await searchParams;
  const filters: Parameters<typeof listTickets>[1] = {};
  if (filter === "ouverts") filters.statut = OUVERT_STATUTS;
  else if (filter === "cloture") filters.statut = CLOTURE_STATUTS;

  const tickets = await listTickets(ctx.communeId, filters);

  const service = await createServiceClient();
  const [
    { data: commune },
    { data: commentairesAll },
    { data: assigneesAll },
  ] = await Promise.all([
    service
      .from("communes")
      .select("name, slug, logo_url")
      .eq("id", ctx.communeId)
      .single(),
    service
      .from("ticket_commentaires")
      .select("id, ticket_id, contenu, is_systeme, created_at, auteur_id")
      .in("ticket_id", tickets.map((t) => t.id))
      .order("created_at", { ascending: true }),
    service
      .from("ticket_assignees")
      .select("ticket_id, profiles:profile_id ( id, full_name )")
      .in("ticket_id", tickets.map((t) => t.id)),
  ]);

  type AssigneeRow = {
    ticket_id: string;
    profiles: { id: string; full_name: string | null } | null;
  };
  const assigneesByTicket = new Map<string, string[]>();
  for (const row of (assigneesAll ?? []) as unknown as AssigneeRow[]) {
    if (!row.profiles?.full_name) continue;
    const arr = assigneesByTicket.get(row.ticket_id) ?? [];
    arr.push(row.profiles.full_name);
    assigneesByTicket.set(row.ticket_id, arr);
  }

  const commentairesByTicket = new Map<string, typeof commentairesAll>();
  for (const c of commentairesAll ?? []) {
    const arr = commentairesByTicket.get(c.ticket_id) ?? [];
    arr!.push(c);
    commentairesByTicket.set(c.ticket_id, arr);
  }

  // URLs signées des photos
  const photoUrls = new Map<string, string>();
  await Promise.all(
    tickets.flatMap((t) => {
      const first = t.signalement_photos?.[0];
      if (!first) return [];
      return [
        getPhotoSignedUrl(first.storage_path).then((url) => {
          if (url) photoUrls.set(t.id, url);
        }),
      ];
    }),
  );

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      {auto === "1" && <PrintAutoTrigger />}

      {/* Toolbar — non imprimée */}
      <div className="tk-print-toolbar print-hide">
        <Link href="/admin/tickets" className="civiq-btn civiq-btn-ghost">
          <ArrowLeft size={14} /> Retour aux tickets
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
          {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
          {filter !== "tous" && ` · filtre : ${filter === "ouverts" ? "ouverts" : "clôturés"}`}
        </span>
        <PrintButton />
      </div>

      {/* Document à imprimer */}
      <main className="tk-print-doc">
        <header className="tk-print-header">
          <div>
            <div className="tk-print-eyebrow">Synthèse Tickets d&apos;intervention</div>
            <h1 className="tk-print-title">{commune?.name ?? "Commune"}</h1>
          </div>
          <div className="tk-print-meta">
            <div>{today}</div>
            <div>
              {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
              {filter !== "tous" && ` (${filter === "ouverts" ? "ouverts" : "clôturés"})`}
            </div>
          </div>
        </header>

        {tickets.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666", padding: "40px 0" }}>
            Aucun ticket à afficher.
          </p>
        ) : (
          <div className="tk-print-list">
            {tickets.map((t) => {
              const photoUrl = photoUrls.get(t.id);
              const comments = commentairesByTicket.get(t.id) ?? [];
              const agentNames = assigneesByTicket.get(t.id)
                ?? (t.assignee_profile?.full_name ? [t.assignee_profile.full_name] : []);
              const created = new Date(t.created_at).toLocaleString("fr-FR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              });
              const group = groupOf(t.statut);

              return (
                <article key={t.id} className="tk-print-ticket">
                  <div className="tk-print-ticket-head">
                    <span className="tk-print-numero">#{t.numero}</span>
                    <h2 className="tk-print-titre">{t.titre}</h2>
                    <div className="tk-print-tags">
                      <span className={`tk-print-tag tk-print-tag-prio-${t.priorite}`}>
                        {PRIORITE_LABELS[t.priorite]}
                      </span>
                      <span className={`tk-print-tag tk-print-tag-${group}`}>
                        {GROUP_LABELS[group]} · {STATUT_LABELS[t.statut]}
                      </span>
                      <span className="tk-print-tag tk-print-tag-cat">
                        {CATEGORIE_ICONS[t.categorie]} {CATEGORIE_LABELS[t.categorie]}
                      </span>
                    </div>
                  </div>

                  <div
                    className={
                      photoUrl
                        ? "tk-print-ticket-body"
                        : "tk-print-ticket-body tk-print-ticket-body--no-photo"
                    }
                  >
                    {photoUrl && (
                      <div className="tk-print-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl} alt="" />
                      </div>
                    )}
                    <div className="tk-print-fields">
                      {t.description && (
                        <Kv label="Description">{t.description}</Kv>
                      )}
                      {t.adresse && <Kv label="Adresse">{t.adresse}</Kv>}
                      <Kv label="Créé le">{created}</Kv>
                      <Kv label="Canal">{CANAL_LABELS[t.canal]}</Kv>
                      {(t.demandeur_nom || t.demandeur_telephone || t.demandeur_email) && (
                        <Kv label="Demandeur">
                          {[t.demandeur_nom, t.demandeur_telephone, t.demandeur_email]
                            .filter(Boolean).join(" · ")}
                        </Kv>
                      )}
                      <Kv label="Agent(s) assigné(s)">
                        {agentNames.length ? agentNames.join(", ") : "Non assigné"}
                      </Kv>
                    </div>
                  </div>

                  {comments && comments.length > 0 && (
                    <div className="tk-print-journal">
                      <div className="tk-print-journal-title">Journal d&apos;activité</div>
                      <ul>
                        {comments.map((c) => (
                          <li key={c.id}>
                            <span className="tk-print-journal-date">
                              {new Date(c.created_at).toLocaleString("fr-FR", {
                                day: "2-digit", month: "2-digit",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            <span className="tk-print-journal-type">
                              {c.is_systeme ? "Système" : "Commentaire"}
                            </span>
                            <span className="tk-print-journal-content">{c.contenu}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <footer className="tk-print-footer">
          Document généré le {today} · GoCiviq
        </footer>
      </main>
    </>
  );
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tk-print-kv">
      <div className="tk-print-kv-label">{label}</div>
      <div className="tk-print-kv-value">{children}</div>
    </div>
  );
}


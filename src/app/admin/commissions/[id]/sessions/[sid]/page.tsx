import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import "../../../../projects/projects.css";
import { requireCommune } from "@/lib/auth-helpers";
import { isModuleActive } from "@/lib/module-guard";
import { getSession } from "@/lib/projects/queries";
import AttendanceEditor from "@/components/projects/AttendanceEditor";
import MinutesEditor from "@/components/projects/MinutesEditor";
import SessionDocumentsEditor from "@/components/projects/SessionDocumentsEditor";
import SignedAttendanceUpload from "@/components/projects/SignedAttendanceUpload";
import SessionSecretarySelector from "@/components/projects/SessionSecretarySelector";

// ═══════════════════════════════════════════════════════════════
// /admin/commissions/:id/sessions/:sid — détail d'une séance.
// Émargement (signature) + relevé de décisions + compte rendu.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps { params: Promise<{ id: string; sid: string }>; }

export default async function SessionDetailPage({ params }: PageProps) {
  const { id, sid } = await params;
  const ctx = await requireCommune();
  if (ctx.role !== "super_admin" && ctx.communeId) {
    const active = await isModuleActive("projects");
    if (!active) redirect("/admin/dashboard?module=projects&state=inactive");
  }
  if (!ctx.communeId) redirect("/admin/onboarding");

  const detail = await getSession(ctx.communeId, sid);
  if (!detail.session) notFound();

  const isAdmin = ["admin", "super_admin"].includes(ctx.role ?? "");
  const isSecretaire = detail.session.secretaire_de_seance_user_id === ctx.userId;
  const canEditMinutes = isAdmin || isSecretaire;
  const canManageDocs = ["admin", "editor", "super_admin"].includes(ctx.role ?? "");

  // Quorum
  const totalMembers = detail.members.length;
  const presentCount = detail.attendance.filter((a) => a.present === true).length;
  // Les signatures restent ouvertes tant que le compte rendu n'est
  // pas validé (verrouillé). Une fois le CR validé, on lock.
  const signaturesLocked = detail.session.compte_rendu_valide;

  // Candidats secrétaire = membres internes (avec compte GoCiviq) de la
  // commission. Les externes (sans user_id) ne peuvent pas éditer le CR.
  const secretaryCandidates = detail.members
    .filter((m) => m.user_id && m.profile)
    .map((m) => ({ id: m.user_id!, full_name: m.profile?.full_name ?? null }));
  const currentSecretaryName = detail.members.find(
    (m) => m.user_id === detail.session?.secretaire_de_seance_user_id,
  )?.profile?.full_name ?? null;

  const dateLabel = new Date(detail.session.date_seance).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <main className="civiq-main pj-detail-page">
      <div className="pj-detail-back">
        <Link href={`/admin/commissions/${id}`} className="civiq-btn civiq-btn-ghost civiq-btn-sm">
          <ArrowLeft size={14} /> Commission
        </Link>
      </div>

      <header className="pj-detail-header">
        <div>
          <h1 className="civiq-page-title">{detail.commission?.nom}</h1>
          <p className="pj-page-subtitle">{dateLabel}{detail.session.lieu && <> — {detail.session.lieu}</>}</p>
          <div style={{ marginTop: 8 }}>
            <SessionSecretarySelector
              commissionId={id}
              sessionId={sid}
              candidates={secretaryCandidates}
              current={detail.session.secretaire_de_seance_user_id}
              currentName={currentSecretaryName}
              canEdit={canManageDocs}
            />
          </div>
        </div>
        <div className="pj-page-header-actions">
          <a
            href={`/projects-pdf?kind=attendance&cid=${id}&sid=${sid}`}
            target="_blank"
            rel="noreferrer"
            className="civiq-btn civiq-btn-outline"
          >
            <Printer size={14} /> Feuille d&apos;émargement
          </a>
          {detail.session.compte_rendu_valide && (
            <a
              href={`/projects-pdf?kind=minutes&cid=${id}&sid=${sid}`}
              target="_blank"
              rel="noreferrer"
              className="civiq-btn civiq-btn-outline"
            >
              <FileText size={14} /> Compte rendu PDF
            </a>
          )}
        </div>
      </header>

      <div className="pj-detail-grid">
        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">Ordre du jour</h2>
          {detail.session.ordre_du_jour ? (
            // ordre_du_jour est passé par sanitizeRichText à l'écriture →
            // sûr à injecter en HTML
            <div
              className="pj-rich"
              dangerouslySetInnerHTML={{ __html: detail.session.ordre_du_jour }}
            />
          ) : (
            <p className="pj-section-empty">Pas d&apos;ordre du jour renseigné.</p>
          )}
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">
            Émargement <span className="pj-section-count">({presentCount} / {totalMembers} présents)</span>
          </h2>

          {/* Option PDF scanné : pratique quand on fait signer sur papier en séance */}
          <SignedAttendanceUpload
            commissionId={id}
            sessionId={sid}
            initialUrl={detail.session.signed_attendance_pdf_url}
            initialUploadedAt={detail.session.signed_attendance_uploaded_at}
            canEdit={canManageDocs}
          />

          <AttendanceEditor
            commissionId={id}
            sessionId={sid}
            members={detail.members.map((m) => ({
              member_id: m.id,
              user_id: m.user_id,
              full_name: m.profile?.full_name ?? m.external_name ?? "—",
              role: m.role,
              isExternal: !m.user_id,
            }))}
            attendance={detail.attendance.map((a) => ({
              member_id: a.commission_member_id,
              user_id: a.conseiller_user_id,
              present: a.present,
              signature_data: a.signature_data,
              signe_le: a.signe_le,
            }))}
            currentUserId={ctx.userId}
            isAdmin={isAdmin}
            signaturesLocked={signaturesLocked}
          />
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">
            Documents de la séance
            <span className="pj-section-count">({detail.documents.length})</span>
          </h2>
          <SessionDocumentsEditor
            commissionId={id}
            sessionId={sid}
            initial={detail.documents.map((d) => ({
              id: d.id,
              session_id: d.session_id,
              nom: d.nom,
              url: d.url,
              type: d.type,
              uploaded_at: d.uploaded_at,
            }))}
            canEdit={canManageDocs}
          />
        </section>

        <section className="civiq-card pj-section pj-section-wide">
          <h2 className="pj-section-title">
            Compte rendu
            {detail.session.compte_rendu_valide && (
              <span className="civiq-badge civiq-badge-success">Validé / verrouillé</span>
            )}
          </h2>
          <MinutesEditor
            commissionId={id}
            sessionId={sid}
            initial={detail.session.compte_rendu ?? ""}
            validated={detail.session.compte_rendu_valide}
            canEdit={canEditMinutes}
          />
        </section>
      </div>
    </main>
  );
}

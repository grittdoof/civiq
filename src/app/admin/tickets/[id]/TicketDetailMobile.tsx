"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, MoreVertical, MapPin } from "lucide-react";
import TicketLocationMap from "@/components/tickets/TicketLocationMap";
import {
  TKHeader,
  TKStatusBadge,
  TKPriorityBadge,
  TKCategoryChip,
  TKAvatar,
  TKButton,
  TKCtaBar,
  TKSheet,
  TKInput,
  TKPhoto,
} from "@/components/tickets/ui/tk-primitives";
import { TK } from "@/lib/tickets/design-tokens";
import {
  updateTicketStatus,
  setTicketAssignees,
  addTicketComment,
} from "@/lib/tickets/mutations";
import {
  CANAL_LABELS,
  type TicketCanal,
  type TicketCategorie,
  type TicketPriorite,
  type TicketStatut,
  type TicketCommentaire,
  type TicketRapport,
  type TicketPhoto as TicketPhotoT,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// TicketDetailMobile — Vue détail refondue (phase 4, direction Airbnb).
// Hero photo + sections hairline + timeline + sheets assignation/commentaire.
// CTA bar bas : Prendre en charge + Clôturer (contextuels au statut).
// ═══════════════════════════════════════════════════════════════

type SheetKind = "assign" | "comment" | null;

interface PhotoWithUrl extends TicketPhotoT {
  url: string | null;
}

interface Props {
  ticket: {
    id: string;
    numero: number;
    titre: string;
    description: string | null;
    statut: TicketStatut;
    priorite: TicketPriorite;
    categorie: TicketCategorie;
    canal: TicketCanal;
    adresse: string | null;
    latitude: number | null;
    longitude: number | null;
    precision_geo: string | null;
    created_at: string;
    created_by: string | null;
    created_by_name: string | null;
    assigne_a: string | null;
  };
  signalementPhotos: PhotoWithUrl[];
  serviceFaitPhotos: PhotoWithUrl[];
  commentaires: TicketCommentaire[];
  rapport: TicketRapport | null;
  assignees: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  agents: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
  }>;
  perms: {
    canEdit: boolean;
    canAssign: boolean;
    canComment: boolean;
  };
}

export default function TicketDetailMobile({
  ticket,
  signalementPhotos,
  serviceFaitPhotos,
  commentaires,
  rapport,
  assignees,
  agents,
  perms,
}: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    assignees.map((a) => a.id),
  );
  const [photoIndex, setPhotoIndex] = useState(0);

  const activeStatus = ["nouveau", "assigne", "pris_en_charge", "en_cours", "en_attente"];
  const isOpen = activeStatus.includes(ticket.statut);
  const heroPhoto = signalementPhotos[photoIndex];

  function takeCharge() {
    startTransition(async () => {
      try {
        const target: TicketStatut =
          ticket.statut === "nouveau" || ticket.statut === "assigne"
            ? "pris_en_charge"
            : ticket.statut === "en_attente"
              ? "en_cours"
              : "pris_en_charge";
        await updateTicketStatus(ticket.id, target);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function saveAssignees() {
    startTransition(async () => {
      try {
        await setTicketAssignees(ticket.id, selectedAssignees);
        setSheet(null);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function publishComment() {
    if (!comment.trim()) return;
    startTransition(async () => {
      try {
        await addTicketComment(ticket.id, comment.trim());
        setComment("");
        setSheet(null);
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function toggleAssignee(id: string) {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col bg-white">
      <TKHeader
        onBack={() => router.push("/admin/tickets")}
        title={`#${ticket.numero}`}
        right={
          <Link
            href={`/admin/tickets/${ticket.id}/cloturer`}
            aria-label="Plus d'actions"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-0"
            style={{ background: TK.bg2, color: TK.ink }}
          >
            <MoreVertical size={16} />
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: isOpen ? 120 : 32 }}>
        {/* HERO PHOTO */}
        <div className="px-[18px]">
          <div className="relative overflow-hidden rounded-[18px]">
            {heroPhoto?.url ? (
              <div
                className="relative w-full overflow-hidden rounded-[18px]"
                style={{ height: 220, background: "#E5E7EB" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroPhoto.url}
                  alt={heroPhoto.legende ?? ""}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <TKPhoto categorie={ticket.categorie} size="lg" />
            )}
            <div className="absolute left-3 top-3 flex gap-1.5">
              <TKPriorityBadge priorite={ticket.priorite} />
              <TKStatusBadge statut={ticket.statut} />
            </div>
            {signalementPhotos.length > 1 && (
              <div
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                style={{ background: "rgba(10,14,26,0.62)" }}
              >
                <Camera size={11} />
                {photoIndex + 1} / {signalementPhotos.length}
              </div>
            )}
          </div>
          {signalementPhotos.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto">
              {signalementPhotos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  className="shrink-0 overflow-hidden rounded-[10px]"
                  style={{
                    width: 56,
                    height: 56,
                    border: `2px solid ${i === photoIndex ? TK.ink : "transparent"}`,
                  }}
                >
                  {p.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TITRE */}
        <div className="px-[22px] pb-2 pt-[22px]">
          <h1
            className="m-0 font-bold"
            style={{
              color: TK.ink,
              fontSize: 26,
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
            }}
          >
            {ticket.titre}
          </h1>
          <div
            className="mt-2 flex items-center gap-2 text-[13px]"
            style={{ color: TK.ink2 }}
          >
            <TKCategoryChip categorie={ticket.categorie} size="sm" />
            <span style={{ color: TK.muted }}>·</span>
            <span>{formatDateTime(ticket.created_at)}</span>
          </div>
        </div>

        <Divider />

        {/* CRÉATEUR */}
        <Section>
          <div className="flex items-center gap-3">
            <TKAvatar
              name={ticket.created_by_name}
              seed={ticket.created_by ?? ""}
              size={44}
            />
            <div className="flex-1">
              <div
                className="text-[14px] font-bold"
                style={{ color: TK.ink }}
              >
                Signalé par {ticket.created_by_name ?? "—"}
              </div>
              <div
                className="mt-0.5 text-[12px]"
                style={{ color: TK.muted }}
              >
                Canal : {CANAL_LABELS[ticket.canal]}
              </div>
            </div>
          </div>
        </Section>

        {ticket.description && (
          <>
            <Divider />
            <Section>
              <Eyebrow>Description</Eyebrow>
              <p
                className="m-0 mt-2 text-[15px]"
                style={{ color: TK.ink, lineHeight: 1.55 }}
              >
                {ticket.description}
              </p>
            </Section>
          </>
        )}

        {(ticket.adresse || (ticket.latitude && ticket.longitude)) && (
          <>
            <Divider />
            <Section>
              <Eyebrow>Localisation</Eyebrow>
              {ticket.latitude && ticket.longitude ? (
                <div
                  className="mt-3 overflow-hidden rounded-[14px]"
                  style={{ border: `1px solid ${TK.line}` }}
                >
                  <TicketLocationMap
                    lat={ticket.latitude}
                    lng={ticket.longitude}
                    priorite={ticket.priorite}
                    label={ticket.adresse ?? ticket.titre}
                    height={180}
                  />
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-start gap-1.5">
                  <MapPin
                    size={14}
                    className="mt-1 shrink-0"
                    style={{ color: TK.muted }}
                  />
                  <div>
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: TK.ink }}
                    >
                      {ticket.adresse ?? "Position GPS uniquement"}
                    </div>
                    {ticket.latitude && ticket.longitude && (
                      <div
                        className="mt-0.5 font-mono text-[12px]"
                        style={{ color: TK.muted }}
                      >
                        {ticket.latitude.toFixed(5)},{" "}
                        {ticket.longitude.toFixed(5)}
                      </div>
                    )}
                  </div>
                </div>
                {ticket.latitude && ticket.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${ticket.latitude},${ticket.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold no-underline"
                    style={{
                      border: `1.5px solid ${TK.line}`,
                      color: TK.ink,
                    }}
                  >
                    Itinéraire ↗
                  </a>
                )}
              </div>
            </Section>
          </>
        )}

        <Divider />

        {/* ASSIGNÉS */}
        <Section>
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow>Assignés</Eyebrow>
            {perms.canAssign && (
              <button
                type="button"
                onClick={() => setSheet("assign")}
                className="border-0 bg-transparent text-[12px] font-bold"
                style={{ color: TK.azur }}
              >
                + Modifier
              </button>
            )}
          </div>
          {assignees.length === 0 ? (
            <div
              className="rounded-xl px-4 py-3.5 text-[13px]"
              style={{ background: TK.bg2, color: TK.muted }}
            >
              Aucun agent assigné
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {assignees.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <TKAvatar name={a.full_name} seed={a.id} size={38} />
                  <div className="flex-1">
                    <div
                      className="text-[14px] font-semibold"
                      style={{ color: TK.ink }}
                    >
                      {a.full_name ?? "—"}
                    </div>
                    {a.job_title && (
                      <div
                        className="text-[11px] capitalize"
                        style={{ color: TK.muted }}
                      >
                        {a.job_title.replace("_", " ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* SERVICE FAIT (si rapport) */}
        {serviceFaitPhotos.length > 0 && (
          <>
            <Divider />
            <Section>
              <Eyebrow>Service fait</Eyebrow>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {serviceFaitPhotos.map(
                  (p) =>
                    p.url && (
                      <div
                        key={p.id}
                        className="overflow-hidden rounded-xl"
                        style={{ background: "#E5E7EB" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.url}
                          alt=""
                          style={{
                            width: "100%",
                            height: 110,
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    ),
                )}
              </div>
            </Section>
          </>
        )}

        {rapport && (
          <>
            <Divider />
            <Section>
              <Eyebrow>Rapport d&apos;intervention</Eyebrow>
              <div className="mt-3 flex flex-col gap-2 text-[13px]">
                {rapport.description_intervention && (
                  <p
                    className="m-0 whitespace-pre-wrap"
                    style={{ color: TK.ink, lineHeight: 1.55 }}
                  >
                    {rapport.description_intervention}
                  </p>
                )}
                <div
                  className="mt-1 grid gap-2"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}
                >
                  {rapport.duree_minutes != null && (
                    <Kv label="Durée" value={`${rapport.duree_minutes} min`} />
                  )}
                  {rapport.materiaux_utilises && (
                    <Kv label="Matériaux" value={rapport.materiaux_utilises} />
                  )}
                  {rapport.cout_estime != null && (
                    <Kv
                      label="Coût"
                      value={`${rapport.cout_estime.toLocaleString("fr-FR")} €`}
                    />
                  )}
                </div>
              </div>
            </Section>
          </>
        )}

        <Divider />

        {/* TIMELINE */}
        <Section>
          <Eyebrow className="mb-3.5">Activité</Eyebrow>
          {commentaires.length === 0 ? (
            <p
              className="m-0 text-[13px] italic"
              style={{ color: TK.muted }}
            >
              Aucune activité enregistrée pour le moment.
            </p>
          ) : (
            <Timeline items={commentaires} />
          )}

          {perms.canComment && (
            <div className="mt-4 flex items-center gap-2.5">
              <TKAvatar name="Moi" seed="me" size={32} />
              <button
                type="button"
                onClick={() => setSheet("comment")}
                className="flex-1 rounded-full bg-white px-4 py-2.5 text-left text-[13px]"
                style={{
                  border: `1.5px solid ${TK.line}`,
                  color: TK.muted,
                }}
              >
                Ajouter un commentaire…
              </button>
            </div>
          )}
        </Section>
      </div>

      {/* STICKY CTA */}
      {isOpen && perms.canEdit && (
        <TKCtaBar mode="fixed">
          <div className="flex gap-2.5">
            <TKButton
              variant="secondary"
              onClick={takeCharge}
              disabled={pending || ticket.statut === "pris_en_charge" || ticket.statut === "en_cours"}
              fullWidth={false}
              style={{ flex: 1 }}
            >
              {ticket.statut === "pris_en_charge" || ticket.statut === "en_cours"
                ? "En charge"
                : "Prendre en charge"}
            </TKButton>
            <Link
              href={`/admin/tickets/${ticket.id}/cloturer`}
              style={{ flex: 1 }}
            >
              <TKButton variant="primary">Clôturer</TKButton>
            </Link>
          </div>
        </TKCtaBar>
      )}

      {/* SHEETS */}
      <TKSheet
        open={sheet === "assign"}
        onClose={() => setSheet(null)}
        title="Assigner ce ticket"
        footer={
          <TKButton
            variant="primary"
            onClick={saveAssignees}
            disabled={pending}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </TKButton>
        }
      >
        <div className="flex flex-col gap-1">
          {agents.length === 0 && (
            <p className="text-[13px]" style={{ color: TK.muted }}>
              Aucun agent disponible.
            </p>
          )}
          {agents.map((a) => {
            const checked = selectedAssignees.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAssignee(a.id)}
                className="flex items-center gap-3 px-1 py-3 text-left"
              >
                <TKAvatar name={a.full_name} seed={a.id} size={38} />
                <div className="flex-1">
                  <div
                    className="text-[14px] font-semibold"
                    style={{ color: TK.ink }}
                  >
                    {a.full_name ?? "—"}
                  </div>
                  {a.job_title && (
                    <div
                      className="text-[11px] capitalize"
                      style={{ color: TK.muted }}
                    >
                      {a.job_title.replace("_", " ")}
                    </div>
                  )}
                </div>
                <span
                  className="inline-flex items-center justify-center rounded-md text-white"
                  style={{
                    width: 22,
                    height: 22,
                    border: `2px solid ${checked ? TK.ink : TK.line}`,
                    background: checked ? TK.ink : "white",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {checked && "✓"}
                </span>
              </button>
            );
          })}
        </div>
      </TKSheet>

      <TKSheet
        open={sheet === "comment"}
        onClose={() => setSheet(null)}
        title="Ajouter un commentaire"
        footer={
          <TKButton
            variant="primary"
            onClick={publishComment}
            disabled={!comment.trim() || pending}
          >
            {pending ? "Publication…" : "Publier"}
          </TKButton>
        }
      >
        <TKInput
          multiline
          placeholder="Ex. Intervention prévue jeudi matin avec l'équipe voirie."
          value={comment}
          onChange={setComment}
          autoFocus
        />
      </TKSheet>
    </main>
  );
}

// ─── Helpers présentation ────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return <div className="px-[22px] py-2">{children}</div>;
}

function Divider() {
  return (
    <div
      className="my-3.5"
      style={{ height: 1, background: TK.line, margin: "14px 22px" }}
    />
  );
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[11px] font-bold uppercase ${className ?? ""}`}
      style={{ color: TK.muted, letterSpacing: "0.08em" }}
    >
      {children}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold"
        style={{ color: TK.muted }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[13px]"
        style={{ color: TK.ink }}
      >
        {value}
      </div>
    </div>
  );
}

function Timeline({ items }: { items: TicketCommentaire[] }) {
  return (
    <div className="relative flex flex-col gap-4">
      <span
        className="absolute"
        style={{
          left: 11,
          top: 4,
          bottom: 4,
          width: 2,
          background: TK.line,
        }}
      />
      {items.map((c) => {
        const dot = c.is_systeme ? TK.azur : TK.ink2;
        return (
          <div key={c.id} className="relative flex gap-3.5">
            <span
              className="z-10 inline-flex items-center justify-center rounded-full bg-white"
              style={{
                width: 24,
                height: 24,
                boxShadow: `0 0 0 2px ${dot}`,
                flexShrink: 0,
              }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: dot }}
              />
            </span>
            <div className="flex-1 pt-px">
              <div
                className="text-[13px] leading-snug"
                style={{ color: TK.ink }}
              >
                {c.contenu}
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: TK.muted }}
              >
                {formatDateTime(c.created_at)}
                {c.is_systeme ? " · système" : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

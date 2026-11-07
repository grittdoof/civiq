import { cache } from "react";
import { getAuthContext } from "@/lib/auth-helpers";
import { writeAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase-server";
import {
  estSensible, fonctionDe, normaliserLigne, peutVoirTicket,
  type Spectateur, type TicketPourDroits,
} from "./droits";

// ═══════════════════════════════════════════════════════════════
// Droits sur les signalements — accès serveur (lot 1).
//
// Les lectures applicatives se font en service role (RLS contournée) :
// TOUTE lecture de signalements doit passer par `filtrerVisibles` ou
// `chargerTicketVisible`, sinon fuite (même règle que la confidentialité
// des projets, lot F).
// ═══════════════════════════════════════════════════════════════

type Service = Awaited<ReturnType<typeof createServiceClient>>;

/** Spectateur courant (une seule lecture par requête). */
export const chargerSpectateur = cache(async (): Promise<Spectateur | null> => {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const service = await createServiceClient();
  const { data: profil } = await service
    .from("profiles").select("job_title").eq("id", ctx.userId).maybeSingle();
  const fonction = fonctionDe(profil?.job_title ?? null);

  let ligne: Spectateur["ligne"] = null;
  let services = new Set<string>();
  if (ctx.communeId) {
    const [{ data: row }, { data: membres }] = await Promise.all([
      service.from("ticket_matrice")
        .select("fonction, voit, voit_restreints, actions")
        .eq("commune_id", ctx.communeId).eq("fonction", fonction).maybeSingle(),
      service.from("service_membres")
        .select("service_id, services!inner ( commune_id, deleted_at )")
        .eq("profile_id", ctx.userId)
        .eq("services.commune_id", ctx.communeId)
        .is("services.deleted_at", null),
    ]);
    ligne = row ? normaliserLigne(row) : null;
    services = new Set((membres ?? []).map((m) => m.service_id as string));
  }
  return { id: ctx.userId, role: ctx.role, communeId: ctx.communeId, ligne, services };
});

export interface LiensTicket { assignes: string[]; destinataires: string[] }

/** Assignés et destinataires de plusieurs signalements, par lots. */
export async function chargerLiens(service: Service, ids: string[]): Promise<Map<string, LiensTicket>> {
  const map = new Map<string, LiensTicket>();
  for (const id of ids) map.set(id, { assignes: [], destinataires: [] });
  for (let i = 0; i < ids.length; i += 200) {
    const lot = ids.slice(i, i + 200);
    const [{ data: a }, { data: d }] = await Promise.all([
      service.from("ticket_assignees").select("ticket_id, profile_id").in("ticket_id", lot),
      service.from("ticket_destinataires").select("ticket_id, profile_id").in("ticket_id", lot),
    ]);
    for (const r of a ?? []) map.get(r.ticket_id as string)?.assignes.push(r.profile_id as string);
    for (const r of d ?? []) map.get(r.ticket_id as string)?.destinataires.push(r.profile_id as string);
  }
  return map;
}

type LigneTicket = {
  id: string; commune_id: string; created_by: string | null; assigne_a: string | null;
  service_id?: string | null; confidentialite?: string | null;
};

/** Ne garde que les signalements que le spectateur peut voir. */
export async function filtrerVisibles<T extends LigneTicket>(
  service: Service, rows: T[], s: Spectateur | null,
): Promise<T[]> {
  if (!s || rows.length === 0) return [];
  if (s.role === "super_admin") return rows;
  const liens = await chargerLiens(service, rows.map((r) => r.id));
  return rows.filter((r) => peutVoirTicket(versDroits(r, liens.get(r.id)), s));
}

export function versDroits(r: LigneTicket, l?: LiensTicket): TicketPourDroits {
  return {
    commune_id: r.commune_id,
    created_by: r.created_by,
    assigne_a: r.assigne_a,
    service_id: r.service_id ?? null,
    confidentialite: r.confidentialite ?? "standard",
    assignes: l?.assignes ?? [],
    destinataires: l?.destinataires ?? [],
  };
}

export interface TicketVisible {
  id: string; numero: number; commune_id: string; statut: string;
  droits: TicketPourDroits;
}

/** Charge un signalement s'il est visible du spectateur (null sinon). */
export async function chargerTicketVisible(
  service: Service, ticketId: string, s: Spectateur | null,
): Promise<TicketVisible | null> {
  if (!s) return null;
  const { data: t } = await service
    .from("tickets")
    .select("id, numero, commune_id, statut, created_by, assigne_a, service_id, confidentialite")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return null;
  const liens = (await chargerLiens(service, [t.id])).get(t.id);
  const droits = versDroits(t, liens);
  if (!peutVoirTicket(droits, s)) return null;
  return { id: t.id, numero: t.numero, commune_id: t.commune_id, statut: t.statut, droits };
}

/**
 * Consultation d'un signalement restreint ou confidentiel : une entrée
 * par personne, par signalement et par jour dans `audit_log`. Rien sur
 * le contenu (ni titre, ni description) : seulement le numéro.
 */
export async function journaliserConsultation(
  t: { id: string; numero: number; commune_id: string; confidentialite?: string | null },
  s: Spectateur,
): Promise<void> {
  if (!estSensible(t)) return;
  const service = await createServiceClient();
  const debutJour = new Date();
  debutJour.setUTCHours(0, 0, 0, 0);
  const { count } = await service
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "ticket.consultation")
    .eq("target_id", t.id)
    .eq("actor_id", s.id)
    .gte("created_at", debutJour.toISOString());
  if ((count ?? 0) > 0) return;
  await writeAudit({
    action: "ticket.consultation", targetType: "ticket", targetId: t.id, communeId: t.commune_id,
    metadata: { numero: t.numero, niveau: t.confidentialite },
  });
}

/** Modification d'un signalement restreint ou confidentiel. */
export async function journaliserModification(
  t: { id: string; numero?: number; commune_id: string; confidentialite?: string | null },
  quoi: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  if (!estSensible(t)) return;
  await writeAudit({
    action: "ticket.modification", targetType: "ticket", targetId: t.id, communeId: t.commune_id,
    metadata: { numero: t.numero, niveau: t.confidentialite, quoi, ...details },
  });
}

/** Journal des accès d'un signalement (consultations + modifications). */
export async function journalDesAcces(ticketId: string): Promise<Array<{
  id: number; action: string; quand: string; qui: string | null; quoi: string | null;
}>> {
  const service = await createServiceClient();
  const { data } = await service
    .from("audit_log")
    .select("id, action, created_at, actor_id, metadata, profiles:actor_id ( full_name )")
    .eq("target_type", "ticket")
    .eq("target_id", ticketId)
    .in("action", ["ticket.consultation", "ticket.modification"])
    .order("created_at", { ascending: false })
    .limit(30);
  type Row = { id: number; action: string; created_at: string; metadata: { quoi?: string } | null; profiles: { full_name: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, action: r.action, quand: r.created_at,
    qui: r.profiles?.full_name ?? null, quoi: r.metadata?.quoi ?? null,
  }));
}

/** Spectateurs construits pour d'autres personnes (destinataires de notifications). */
export async function spectateursPour(
  service: Service, communeId: string, profileIds: string[],
): Promise<Spectateur[]> {
  if (profileIds.length === 0) return [];
  const [{ data: profils }, { data: matrice }, { data: membres }] = await Promise.all([
    service.from("profiles").select("id, role, commune_id, job_title").in("id", profileIds),
    service.from("ticket_matrice").select("fonction, voit, voit_restreints, actions").eq("commune_id", communeId),
    service.from("service_membres")
      .select("profile_id, service_id, services!inner ( commune_id, deleted_at )")
      .in("profile_id", profileIds)
      .eq("services.commune_id", communeId)
      .is("services.deleted_at", null),
  ]);
  const lignes = new Map((matrice ?? []).map((r) => [r.fonction as string, normaliserLigne(r)]));
  const servicesDe = new Map<string, Set<string>>();
  for (const m of membres ?? []) {
    const set = servicesDe.get(m.profile_id as string) ?? new Set<string>();
    set.add(m.service_id as string);
    servicesDe.set(m.profile_id as string, set);
  }
  return (profils ?? []).map((p) => ({
    id: p.id as string,
    role: p.role as string | null,
    communeId: p.commune_id as string | null,
    ligne: lignes.get(fonctionDe(p.job_title as string | null)) ?? null,
    services: servicesDe.get(p.id as string) ?? new Set<string>(),
  }));
}

/** Parmi `profileIds`, ceux qui peuvent voir le signalement. */
export async function destinatairesVisibles(ticketId: string, profileIds: string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  const service = await createServiceClient();
  const { data: t } = await service
    .from("tickets")
    .select("id, commune_id, created_by, assigne_a, service_id, confidentialite")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return [];
  const droits = versDroits(t, (await chargerLiens(service, [t.id])).get(t.id));
  const spectateurs = await spectateursPour(service, t.commune_id, profileIds);
  return spectateurs.filter((s) => peutVoirTicket(droits, s)).map((s) => s.id);
}

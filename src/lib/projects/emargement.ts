// ═══════════════════════════════════════════════════════════════
// Émargement d'une séance — logique pure, commune à l'écran de séance,
// à la feuille d'émargement PDF et au compte rendu.
//
// Règle : TOUS les membres figurent, qu'ils aient été convoqués ou non :
// présent, excusé, absent — ou « non renseigné » tant que personne n'a
// pointé. La liste = membres actifs de la commission ∪ membres déjà
// inscrits à la séance (un membre parti depuis reste dans l'historique).
// ═══════════════════════════════════════════════════════════════

export type StatutEmargement = "present" | "excuse" | "absent";

export const STATUT_EMARGEMENT: Record<StatutEmargement, string> = {
  present: "Présent",
  excuse: "Excusé",
  absent: "Absent",
};

export interface MembreSource {
  id: string;
  user_id: string | null;
  role: string;
  external_name: string | null;
  deleted_at?: string | null;
  profile: { full_name: string | null } | null;
}

export interface LigneSource {
  conseiller_user_id: string | null;
  commission_member_id: string | null;
  present: boolean | null;
  statut?: StatutEmargement | null;
  signature_data: string | null;
  signe_le: string | null;
  profile?: { full_name: string | null } | null;
}

export interface Emargement {
  /** Clé stable : « u:<user_id> » ou « m:<member_id> ». */
  cle: string;
  member_id: string | null;
  user_id: string | null;
  nom: string;
  role: string;
  externe: boolean;
  /** Ne fait plus partie de la commission (conservé pour l'historique). */
  ancien: boolean;
  statut: StatutEmargement | null;
  signature_data: string | null;
  signe_le: string | null;
}

export function statutDe(l: Pick<LigneSource, "statut" | "present"> | undefined): StatutEmargement | null {
  if (!l) return null;
  if (l.statut) return l.statut;
  return l.present === true ? "present" : l.present === false ? "absent" : null;
}

const ORDRE_ROLE: Record<string, number> = { president: 0, vice_president: 1 };

export function listeEmargement(membres: MembreSource[], lignes: LigneSource[]): Emargement[] {
  const parUser = new Map<string, LigneSource>();
  const parMembre = new Map<string, LigneSource>();
  for (const l of lignes) {
    if (l.conseiller_user_id) parUser.set(l.conseiller_user_id, l);
    if (l.commission_member_id) parMembre.set(l.commission_member_id, l);
  }
  const vus = new Set<string>();
  const out: Emargement[] = [];
  const ajouter = (e: Emargement) => {
    if (vus.has(e.cle)) return;
    vus.add(e.cle);
    out.push(e);
  };

  // 1. Membres de la commission (actifs, ou partis mais inscrits à la séance).
  for (const m of membres) {
    const l = m.user_id ? parUser.get(m.user_id) : parMembre.get(m.id);
    if (m.deleted_at && !l) continue;
    ajouter({
      cle: m.user_id ? `u:${m.user_id}` : `m:${m.id}`,
      member_id: m.id,
      user_id: m.user_id,
      nom: m.profile?.full_name ?? m.external_name ?? "—",
      role: m.role,
      externe: !m.user_id,
      ancien: !!m.deleted_at,
      statut: statutDe(l),
      signature_data: l?.signature_data ?? null,
      signe_le: l?.signe_le ?? null,
    });
  }
  // 2. Lignes de séance dont le membre n'est plus retrouvé (fiche supprimée).
  for (const l of lignes) {
    const cle = l.conseiller_user_id ? `u:${l.conseiller_user_id}` : l.commission_member_id ? `m:${l.commission_member_id}` : null;
    if (!cle || vus.has(cle)) continue;
    ajouter({
      cle,
      member_id: l.commission_member_id,
      user_id: l.conseiller_user_id,
      nom: l.profile?.full_name ?? "Ancien membre",
      role: "membre",
      externe: !l.conseiller_user_id,
      ancien: true,
      statut: statutDe(l),
      signature_data: l.signature_data,
      signe_le: l.signe_le,
    });
  }
  return out.sort(
    (a, b) =>
      Number(a.ancien) - Number(b.ancien) ||
      (ORDRE_ROLE[a.role] ?? 9) - (ORDRE_ROLE[b.role] ?? 9) ||
      a.nom.localeCompare(b.nom, "fr"),
  );
}

export interface Repartition {
  presents: string[];
  excuses: string[];
  absents: string[];
  nonRenseignes: string[];
}

export function repartition(liste: Emargement[]): Repartition {
  const r: Repartition = { presents: [], excuses: [], absents: [], nonRenseignes: [] };
  for (const e of liste) {
    if (e.statut === "present") r.presents.push(e.nom);
    else if (e.statut === "excuse") r.excuses.push(e.nom);
    else if (e.statut === "absent") r.absents.push(e.nom);
    else r.nonRenseignes.push(e.nom);
  }
  return r;
}

/** Pointer les présences : gestionnaires de la séance ; soi-même pour un élu. */
export function peutPointer(input: {
  role: string | null;
  userId: string;
  secretaireId: string | null;
  cible: Pick<Emargement, "user_id">;
}): boolean {
  if (["admin", "editor", "super_admin"].includes(input.role ?? "")) return true;
  if (input.secretaireId && input.secretaireId === input.userId) return true;
  return input.cible.user_id === input.userId;
}

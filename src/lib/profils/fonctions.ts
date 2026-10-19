// ═══════════════════════════════════════════════════════════════
// Fonctions des utilisateurs (profiles.job_title) et leurs groupes.
// Partagé : super-admin (utilisateurs), envoi d'une étape par email.
// ═══════════════════════════════════════════════════════════════

export const FONCTIONS: Array<{ value: string; label: string; group: string }> = [
  { value: "maire", label: "Maire", group: "Élus" },
  { value: "adjoint", label: "Adjoint au maire", group: "Élus" },
  { value: "conseiller", label: "Conseiller municipal", group: "Élus" },
  { value: "dgs", label: "Directeur Général des Services", group: "Services" },
  { value: "secretaire", label: "Secrétaire de mairie", group: "Services" },
  { value: "agent", label: "Agent territorial", group: "Services" },
  { value: "agent_technique", label: "Agent technique", group: "Services" },
  { value: "citoyen", label: "Administré", group: "Citoyens" },
  { value: "autre", label: "Autre", group: "Autres" },
];

export const FONCTION_LABEL: Record<string, string> = Object.fromEntries(FONCTIONS.map((j) => [j.value, j.label]));
export const FONCTION_GROUPE: Record<string, string> = Object.fromEntries(FONCTIONS.map((j) => [j.value, j.group]));
export const ORDRE_GROUPES = ["Services", "Élus", "Citoyens", "Autres", "Non renseigné"];

export const groupeDe = (jobTitle: string | null | undefined) =>
  (jobTitle && FONCTION_GROUPE[jobTitle]) || "Non renseigné";

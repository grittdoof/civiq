import Link from "next/link";
import { FolderKanban, Lock } from "lucide-react";
import { lienConversion, type EtatPasserelle } from "@/lib/projects/passerelle";

interface Props {
  ticketId: string;
  etat: EtatPasserelle;
}

// ═══════════════════════════════════════════════════════════════
// Passerelle signalement → projet (lot G), sur la page du signalement.
// La conversion passe par l'assistant de création (choix du type) ;
// le signalement est alors clos avec le statut « Converti en projet ».
// ═══════════════════════════════════════════════════════════════

export default function TransformTicketButton({ ticketId, etat }: Props) {
  if (etat.kind === "lie") {
    return (
      <>
        <p className="tk-passerelle-text">
          Suivi dans le projet <strong>« {etat.titre} »</strong>
          {etat.corbeille && " (actuellement dans la corbeille)"}.
        </p>
        <Link href={`/admin/projects/${etat.projetId}`} className="civiq-btn civiq-btn-outline civiq-btn-sm">
          <FolderKanban size={14} aria-hidden="true" /> Voir le projet
        </Link>
      </>
    );
  }
  if (etat.kind === "lie_confidentiel") {
    return (
      <p className="tk-passerelle-text">
        <Lock size={13} aria-hidden="true" /> Suivi dans un projet confidentiel de la commune.
      </p>
    );
  }
  return (
    <>
      {etat.kind === "projet_supprime" && (
        <p className="tk-passerelle-text">
          Le projet issu de ce signalement a été supprimé. Vous pouvez rouvrir le signalement ou en refaire un projet.
        </p>
      )}
      <Link href={lienConversion(ticketId)} className="civiq-btn civiq-btn-outline civiq-btn-sm">
        <FolderKanban size={14} aria-hidden="true" /> Transformer en projet
      </Link>
      <p className="tk-passerelle-aide">
        Vous choisirez le type de projet. Le signalement sera ensuite clos avec le statut « Converti en projet ».
      </p>
    </>
  );
}

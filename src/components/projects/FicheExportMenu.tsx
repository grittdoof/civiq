import { FileDown } from "lucide-react";
import LearnMore from "./LearnMore";

// Menu « Exporter la fiche » (brief §2.13) : PDF ou Word, complète
// (usage interne) ou communicable (sans notes internes — CADA, élus).

export default function FicheExportMenu({ projectId }: { projectId: string }) {
  // Écran de chargement animé, qui régénère le document à chaque clic.
  const href = (format: "pdf" | "docx", variante: "complete" | "communicable") =>
    `/projects-pdf?kind=fiche&id=${projectId}&format=${format}&variante=${variante}`;
  return (
    <details className="pj-export-menu">
      <summary className="civiq-btn civiq-btn-outline civiq-btn-sm">
        <FileDown size={14} aria-hidden="true" /> Exporter la fiche
      </summary>
      <div className="pj-export-panel">
        <p className="pj-export-group">Fiche complète <span className="pj-list-muted">— usage interne</span></p>
        <div className="pj-export-links">
          <a href={href("pdf", "complete")} target="_blank" rel="noopener">PDF<span className="pj-sr-only"> (nouvel onglet)</span></a>
          <a href={href("docx", "complete")} target="_blank" rel="noopener">Word<span className="pj-sr-only"> (nouvel onglet)</span></a>
        </div>
        <p className="pj-export-group">Fiche communicable <span className="pj-list-muted">— sans notes internes</span></p>
        <div className="pj-export-links">
          <a href={href("pdf", "communicable")} target="_blank" rel="noopener">PDF<span className="pj-sr-only"> (nouvel onglet)</span></a>
          <a href={href("docx", "communicable")} target="_blank" rel="noopener">Word<span className="pj-sr-only"> (nouvel onglet)</span></a>
        </div>
        <LearnMore label="Quelle version choisir ?">
          <p>
            La version communicable retire les commentaires et les pièces marqués « note interne ». C&apos;est elle qu&apos;on
            transmet à un conseiller municipal ou à un administré qui demande le dossier.
          </p>
          <p>
            Le droit d&apos;accès aux documents administratifs (loi CADA, articles L.311-1 et suivants du code des relations
            entre le public et l&apos;administration) s&apos;applique aux documents achevés ; les notes préparatoires en sont exclues.
          </p>
        </LearnMore>
      </div>
    </details>
  );
}

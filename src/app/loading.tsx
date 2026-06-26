import { Spinner } from "@/components/ui/Skeleton";

// Fallback racine — affiché pendant la nav vers n'importe quelle
// route qui n'a pas son propre loading.tsx. Très léger pour ne pas
// se déclencher sur les transitions internes admin (qui ont leur
// loading.tsx plus précis).

export default function RootLoading() {
  return (
    <div className="civiq-page-loader" role="status" aria-live="polite">
      <span className="civiq-page-loader-spinner">
        <Spinner size={32} stroke={2.5} />
      </span>
      <span className="civiq-page-loader-text">Chargement…</span>
    </div>
  );
}

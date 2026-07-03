import { Spinner } from "@/components/ui/Skeleton";

// Fallback racine — affiché pendant la nav vers n'importe quelle
// route qui n'a pas son propre loading.tsx. Très léger pour ne pas
// se déclencher sur les transitions internes admin (qui ont leur
// loading.tsx plus précis).

export default function RootLoading() {
  return (
    <div className="civiq-page-loader" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="civiq-page-loader-logo"
        src="/brand/logo-vertical.svg"
        alt="GoCiviq"
        width={84}
      />
      <span className="civiq-page-loader-spinner">
        <Spinner size={26} stroke={2.5} />
      </span>
    </div>
  );
}

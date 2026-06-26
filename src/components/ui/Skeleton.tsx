// Squelettes réutilisables pour les états de chargement.
// Pas de "use client" — ce sont des composants RSC compatibles avec
// les fichiers loading.tsx qui s'affichent dès le clic, sans attendre
// le serveur.

import type { CSSProperties } from "react";

interface BaseProps {
  className?: string;
  style?: CSSProperties;
}

/** Bloc rectangulaire avec animation shimmer. */
export function Skeleton({
  width,
  height,
  radius = 6,
  className,
  style,
}: BaseProps & {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}) {
  return (
    <span
      aria-hidden
      className={`civiq-skel${className ? " " + className : ""}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof radius === "number" ? `${radius}px` : radius,
        ...style,
      }}
    />
  );
}

/** Plusieurs lignes de texte avec largeurs variables. */
export function SkeletonText({
  lines = 3,
  className,
}: BaseProps & { lines?: number }) {
  // Dernière ligne plus courte pour mimer un paragraphe.
  const widths = Array.from({ length: lines }, (_, i) =>
    i === lines - 1 ? "60%" : "100%",
  );
  return (
    <div className={className} aria-hidden>
      {widths.map((w, i) => (
        <Skeleton
          key={i}
          width={w}
          height={13}
          style={{ marginBottom: 8, display: "block" }}
        />
      ))}
    </div>
  );
}

/** Carte avec un titre, un sous-titre et un bloc. */
export function SkeletonCard({ height = 140 }: { height?: number }) {
  return (
    <div className="civiq-skel-card" aria-hidden>
      <Skeleton width="40%" height={14} style={{ marginBottom: 10 }} />
      <Skeleton width="70%" height={22} style={{ marginBottom: 14 }} />
      <Skeleton width="100%" height={height - 60} />
    </div>
  );
}

/** Header de page (titre + sous-titre + actions). */
export function SkeletonPageHeader({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="civiq-skel-page-header" aria-hidden>
      <div>
        <Skeleton width={240} height={28} style={{ marginBottom: 10 }} />
        <Skeleton width={420} height={14} />
      </div>
      {withActions && (
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={120} height={38} radius={8} />
          <Skeleton width={150} height={38} radius={8} />
        </div>
      )}
    </div>
  );
}

/** Tableau générique avec n lignes. */
export function SkeletonTable({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="civiq-skel-table" aria-hidden>
      <div className="civiq-skel-table-row civiq-skel-table-head">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="70%" height={11} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="civiq-skel-table-row">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} width={c === 0 ? "85%" : "60%"} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Spinner circulaire (pour l'overlay de navigation). */
export function Spinner({ size = 24, stroke = 2.5 }: { size?: number; stroke?: number }) {
  return (
    <svg
      className="civiq-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth={stroke}
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

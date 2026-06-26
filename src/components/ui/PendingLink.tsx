"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./Skeleton";

// ═══════════════════════════════════════════════════════════════
// PendingLink — wrapper de <Link> qui affiche un état "pending"
// pendant la navigation Next.js (clic → réception du loading.tsx).
//
// Utilise useLinkStatus (Next.js 15 + React 19) qui expose le statut
// de navigation au composant ENFANT direct d'un <Link>.
// ═══════════════════════════════════════════════════════════════

interface Props extends ComponentProps<typeof Link> {
  children: ReactNode;
  /** Position du spinner (par défaut à gauche). */
  spinnerPosition?: "start" | "end";
}

export default function PendingLink({
  children,
  spinnerPosition = "start",
  className,
  ...rest
}: Props) {
  return (
    <Link {...rest} className={className}>
      <PendingContent spinnerPosition={spinnerPosition}>{children}</PendingContent>
    </Link>
  );
}

// useLinkStatus doit être appelé dans un descendant du Link.
function PendingContent({
  children,
  spinnerPosition,
}: {
  children: ReactNode;
  spinnerPosition: "start" | "end";
}) {
  const { pending } = useLinkStatus();
  return (
    <span className={`civiq-pending-content${pending ? " is-pending" : ""}`}>
      {pending && spinnerPosition === "start" && (
        <Spinner size={14} stroke={2} />
      )}
      <span className="civiq-pending-label">{children}</span>
      {pending && spinnerPosition === "end" && (
        <Spinner size={14} stroke={2} />
      )}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Spinner } from "./Skeleton";

// ═══════════════════════════════════════════════════════════════
// NavPendingLink — Link de sidebar qui swap son icône Lucide
// en spinner pendant la navigation. Pas de span wrapper qui
// casserait le flex layout du parent (.civiq-nav-item).
//
// Le composant interne PendingInner est rendu en enfant direct
// du <Link>, ce qui permet à useLinkStatus de détecter l'état.
// ═══════════════════════════════════════════════════════════════

interface Props {
  href: string;
  className?: string;
  icon: ComponentType<{ size?: number }>;
  /** Label affiché à côté de l'icône. */
  label: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  iconSize?: number;
  prefetch?: boolean;
}

export default function NavPendingLink({
  href,
  className,
  icon,
  label,
  onClick,
  style,
  iconSize = 15,
  prefetch,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      style={style}
      prefetch={prefetch}
    >
      <PendingInner icon={icon} label={label} iconSize={iconSize} />
    </Link>
  );
}

function PendingInner({
  icon: Icon,
  label,
  iconSize,
}: {
  icon: ComponentType<{ size?: number }>;
  label: ReactNode;
  iconSize: number;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: iconSize,
            height: iconSize,
            color: "currentColor",
          }}
        >
          <Spinner size={iconSize} stroke={2} />
        </span>
      ) : (
        <Icon size={iconSize} />
      )}
      <span>{label}</span>
    </>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  TK,
  TK_CATEGORIES,
  TK_PRIORITES,
  TK_STATUTS,
  avatarColorFor,
  initialsFor,
} from "@/lib/tickets/design-tokens";
import type {
  TicketCategorie,
  TicketPriorite,
  TicketStatut,
} from "@/lib/tickets/types";

// ═══════════════════════════════════════════════════════════════
// PRIMITIVES — Module Tickets (look Airbnb + identité GoCiviq)
// Inspirées du prototype Claude Design, mais réalisées en Tailwind
// quand le style est statique et en inline-style quand il dépend
// de tokens dynamiques (couleur catégorie, etc.)
// ═══════════════════════════════════════════════════════════════

// ─── BADGE STATUT ──────────────────────────────────────────────
export function TKStatusBadge({
  statut,
  size = "md",
}: {
  statut: TicketStatut;
  size?: "sm" | "md";
}) {
  const cfg = TK_STATUTS[statut];
  if (!cfg) return null;
  const small = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold tracking-tight",
        small ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[5px] text-[11px]",
      )}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

// ─── BADGE PRIORITÉ ────────────────────────────────────────────
export function TKPriorityBadge({
  priorite,
  size = "md",
}: {
  priorite: TicketPriorite;
  size?: "sm" | "md";
}) {
  const cfg = TK_PRIORITES[priorite];
  if (!cfg) return null;
  const small = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-bold",
        small ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[5px] text-[11px]",
      )}
      style={{ background: cfg.color + "14", color: cfg.color }}
    >
      <span
        className="inline-block rounded-sm"
        style={{ width: 7, height: 7, background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

// ─── CHIP CATÉGORIE ────────────────────────────────────────────
export function TKCategoryChip({
  categorie,
  size = "md",
}: {
  categorie: TicketCategorie;
  size?: "sm" | "md";
}) {
  const cfg = TK_CATEGORIES[categorie];
  if (!cfg) return null;
  const small = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        small ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[5px] text-[11px]",
      )}
      style={{ background: TK.bg2, color: TK.ink2 }}
    >
      <span className={small ? "text-[11px]" : "text-xs"}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── AVATAR ────────────────────────────────────────────────────
export function TKAvatar({
  name,
  seed,
  size = 28,
  ring = false,
  className,
}: {
  name?: string | null;
  seed?: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const init = initialsFor(name);
  const color = avatarColorFor(seed || name || "?");
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-white font-bold tracking-tight",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.36,
        boxShadow: ring ? "0 0 0 2px white" : "none",
      }}
    >
      {init}
    </div>
  );
}

// ─── AVATAR STACK ──────────────────────────────────────────────
export interface TKAvatarStackItem {
  id: string;
  name?: string | null;
}

export function TKAvatarStack({
  agents,
  size = 24,
  max = 3,
}: {
  agents: TKAvatarStackItem[];
  size?: number;
  max?: number;
}) {
  const visible = agents.slice(0, max);
  const rest = agents.length - visible.length;
  return (
    <div className="inline-flex">
      {visible.map((a, i) => (
        <div key={a.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <TKAvatar name={a.name} seed={a.id} size={size} ring />
        </div>
      ))}
      {rest > 0 && (
        <div
          className="inline-flex items-center justify-center rounded-full font-bold"
          style={{
            marginLeft: -8,
            width: size,
            height: size,
            background: TK.bg2,
            color: TK.ink2,
            fontSize: size * 0.36,
            boxShadow: "0 0 0 2px white",
          }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// ─── BUTTON (Airbnb-style) ────────────────────────────────────
type TKButtonVariant = "primary" | "marine" | "azur" | "danger" | "secondary" | "ghost";
type TKButtonSize = "lg" | "md" | "sm";

export interface TKButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TKButtonVariant;
  size?: TKButtonSize;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  asChild?: boolean;
}

const TKBUTTON_VARIANT: Record<TKButtonVariant, React.CSSProperties> = {
  primary: { background: TK.ink, color: "white" },
  marine: { background: TK.marine, color: "white" },
  azur: { background: TK.azur, color: "white" },
  danger: { background: TK.rouge, color: "white" },
  secondary: {
    background: "white",
    color: TK.ink,
    boxShadow: "inset 0 0 0 1.5px " + TK.line,
  },
  ghost: { background: "transparent", color: TK.ink },
};

const TKBUTTON_SIZE: Record<TKButtonSize, string> = {
  lg: "px-[22px] py-4 text-[15px] min-h-[54px]",
  md: "px-[18px] py-3 text-sm min-h-[46px]",
  sm: "px-[14px] py-[9px] text-[13px] min-h-[38px]",
};

export const TKButton = React.forwardRef<HTMLButtonElement, TKButtonProps>(
  (
    {
      variant = "primary",
      size = "lg",
      icon,
      fullWidth = true,
      className,
      disabled,
      style,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[14px] border-0 font-semibold transition-[background,transform] duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40",
        fullWidth && "w-full",
        TKBUTTON_SIZE[size],
        className,
      )}
      style={{ ...TKBUTTON_VARIANT[variant], ...style }}
      {...props}
    >
      {icon}
      {children}
    </button>
  ),
);
TKButton.displayName = "TKButton";

// ─── INPUT (Airbnb : gros, soft border, focus noir) ────────────
export interface TKInputProps {
  label?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  hint?: string;
  type?: string;
  rows?: number;
  className?: string;
}

export function TKInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  maxLength,
  autoFocus,
  hint,
  type = "text",
  rows = 4,
  className,
}: TKInputProps) {
  const [focus, setFocus] = React.useState(false);
  const Tag = multiline ? "textarea" : "input";
  return (
    <label className={cn("block", className)}>
      {label && (
        <span
          className="mb-2 block text-xs font-semibold tracking-tight"
          style={{ color: TK.ink2 }}
        >
          {label}
        </span>
      )}
      <Tag
        autoFocus={autoFocus}
        {...(!multiline ? { type } : {})}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={multiline ? rows : undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={cn(
          "block w-full rounded-xl bg-white px-4 py-[14px] text-[15px] outline-none transition-colors",
          multiline ? "min-h-[110px] resize-y" : "resize-none",
        )}
        style={{
          border: `1.5px solid ${focus ? TK.ink : TK.line}`,
          color: TK.ink,
        }}
      />
      {hint && (
        <span
          className="mt-1.5 block text-[11px]"
          style={{ color: TK.muted }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

// ─── BOTTOM SHEET ──────────────────────────────────────────────
export function TKSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/35 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-[22px] bg-white"
        style={{ animation: "tk-sheet-up 0.28s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="flex justify-center pt-2.5">
          <span
            className="block rounded"
            style={{ width: 36, height: 4, background: TK.line }}
          />
        </div>
        {title && (
          <div className="flex items-center justify-between px-[22px] pb-1 pt-3.5">
            <h3
              className="m-0 text-lg font-bold tracking-tight"
              style={{ color: TK.ink }}
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-0 text-base"
              style={{ background: TK.bg2, color: TK.ink }}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-[22px] pb-4 pt-2">
          {children}
        </div>
        {footer && (
          <div
            className="bg-white pb-[22px] pt-3"
            style={{
              borderTop: `1px solid ${TK.line}`,
              paddingLeft: 22,
              paddingRight: 22,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STEP BAR (segmented progress) ─────────────────────────────
export function TKStepBar({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 px-[22px] pb-[14px]", className)}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded"
          style={{
            height: 3,
            background: i <= current ? TK.ink : TK.line,
            transition: "background 0.25s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── HEADER MOBILE ─────────────────────────────────────────────
export function TKHeader({
  onBack,
  onClose,
  title,
  right,
  transparent,
}: {
  onBack?: () => void;
  onClose?: () => void;
  title?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 px-[18px] pb-3.5 pt-2.5",
        !transparent && "bg-white",
      )}
    >
      <div className="flex min-w-[38px]">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-0 text-lg"
            style={{ background: TK.bg2, color: TK.ink }}
            aria-label="Retour"
          >
            ‹
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-0 text-sm"
            style={{ background: TK.bg2, color: TK.ink }}
            aria-label="Fermer"
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="flex-1 text-center text-sm font-semibold tracking-tight"
        style={{ color: TK.ink }}
      >
        {title}
      </div>
      <div className="flex min-w-[38px] justify-end">{right}</div>
    </div>
  );
}

// ─── CTA BAR (position bouton selon Tweak) ────────────────────
export function TKCtaBar({
  children,
  mode = "fixed",
}: {
  children: React.ReactNode;
  mode?: "fixed" | "floating" | "inline";
}) {
  if (mode === "inline") {
    return <div className="px-[22px] pb-[22px]">{children}</div>;
  }
  if (mode === "floating") {
    return (
      <div
        className="absolute bottom-4 left-4 right-4 z-[5] rounded-2xl"
        style={{ boxShadow: "0 12px 28px rgba(4,47,100,0.18)" }}
      >
        {children}
      </div>
    );
  }
  // fixed (default)
  return (
    <div
      className="bg-white px-[22px] pt-3.5"
      style={{
        borderTop: `1px solid ${TK.line}`,
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
      }}
    >
      {children}
    </div>
  );
}

// ─── PHOTO (placeholder ou image) ──────────────────────────────
export function TKPhoto({
  src,
  alt,
  categorie,
  label,
  size = "md",
  className,
}: {
  src?: string | null;
  alt?: string;
  categorie?: TicketCategorie;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const cat = categorie ? TK_CATEGORIES[categorie] : null;
  const heights = { sm: 72, md: 110, lg: 200 } as const;
  const iconSize = { sm: 22, md: 32, lg: 56 } as const;

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
      style={{
        height: heights[size],
        background: cat ? cat.color + "18" : "#E5E7EB",
        color: cat ? cat.color : TK.muted,
        fontSize: iconSize[size],
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="h-full w-full object-cover" />
      ) : cat ? (
        <span aria-hidden>{cat.icon}</span>
      ) : (
        <span aria-hidden>📷</span>
      )}
      {label && (
        <span
          className="absolute bottom-1.5 left-2 rounded px-2 py-[2px] text-[10px] font-semibold text-white"
          style={{ background: "rgba(10,14,26,0.55)" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

// ─── FAB (Nouveau ticket) ──────────────────────────────────────
export function TKFab({
  onClick,
  children = "Nouveau ticket",
  className,
}: {
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed z-30 inline-flex items-center gap-2 rounded-full border-0 px-[22px] py-3.5 text-sm font-semibold",
        className,
      )}
      style={{
        right: 18,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
        background: TK.ink,
        color: "white",
        boxShadow: "0 12px 28px rgba(10,14,26,0.25)",
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full text-base leading-none"
        style={{
          width: 22,
          height: 22,
          background: "rgba(255,255,255,0.18)",
        }}
      >
        +
      </span>
      {children}
    </button>
  );
}

// ─── PILL FILTER (filtres scrollables) ─────────────────────────
export function TKFilterPill({
  active,
  count,
  onClick,
  children,
}: {
  active?: boolean;
  count?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-0 px-3.5 py-2 text-[13px] font-semibold transition-colors"
      style={{
        background: active ? TK.ink : TK.bg2,
        color: active ? "white" : TK.ink,
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          className="inline-block min-w-[18px] rounded-full px-1.5 text-center text-[11px] font-bold"
          style={{
            background: active ? "rgba(255,255,255,0.22)" : "white",
            color: active ? "white" : TK.ink2,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── SEARCH BAR (Airbnb : pill avec ombre) ─────────────────────
export function TKSearchBar({
  value,
  onChange,
  placeholder = "Rechercher…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-full bg-white px-4 py-[11px]"
      style={{
        boxShadow: `0 2px 10px rgba(0,0,0,0.06), 0 0 0 1px ${TK.line}`,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke={TK.ink2} strokeWidth="2" />
        <path
          d="M21 21l-4-4"
          stroke={TK.ink2}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border-0 bg-transparent text-[13px] outline-none"
        style={{ color: TK.ink }}
      />
    </div>
  );
}

// ─── CSS keyframes globales ────────────────────────────────────
// (injectées une seule fois côté client)
if (typeof document !== "undefined" && !document.getElementById("tk-anim-css")) {
  const s = document.createElement("style");
  s.id = "tk-anim-css";
  s.textContent = `
    @keyframes tk-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes tk-fade-in  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .tk-fade { animation: tk-fade-in 0.28s cubic-bezier(.2,.8,.2,1) both; }
  `;
  document.head.appendChild(s);
}

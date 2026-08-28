"use client";

import { forwardRef } from "react";

import { motion } from "motion/react";

import { DURATION, EASE, press } from "@/lib/motion";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
  loading?: boolean;
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-sunk",
  ghost: "text-ink-muted hover:text-ink",
  danger: "border border-line bg-surface text-danger hover:bg-surface-sunk",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, disabled, ...rest },
  ref,
) {
  const sizes = size === "lg" ? "h-11 px-5 text-[14px]" : "h-9 px-4 text-[13px]";
  return (
    <motion.button
      ref={ref}
      {...press}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center gap-2 rounded-control font-medium transition-opacity disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${sizes} ${className}`}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      <span className={loading ? "opacity-0" : "contents"}>{children}</span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <PendingDot />
        </span>
      ) : null}
    </motion.button>
  );
});

function PendingDot() {
  return (
    <motion.span
      className="size-1.5 rounded-full bg-current"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Indeterminate hairline for a pending transaction. No spinner. */
export function PendingBar({ active }: { active: boolean }) {
  if (!active) return <div className="h-px w-full bg-transparent" />;
  return (
    <div className="h-px w-full overflow-hidden bg-line">
      <motion.div
        className="h-full w-1/3 bg-accent"
        animate={{ x: ["-100%", "300%"] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: EASE }}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export const input =
  "h-10 rounded-control border border-line bg-surface px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-line-strong";

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] uppercase tracking-[0.06em] text-ink-faint">
        {label}
      </span>
      <span className="tnum text-[22px] leading-none text-ink">{value}</span>
      {sub ? <span className="text-[12px] text-ink-muted">{sub}</span> : null}
    </div>
  );
}

export function Fade({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import { press } from "@/lib/motion";
import { toggleTheme, useEffectiveTheme } from "@/lib/theme";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/app", label: "Circles" },
  { href: "/docs", label: "Docs" },
];

const rowClass =
  "flex h-12 items-center justify-between border-b border-line text-[15px] last:border-0";

/**
 * The header nav collapses below `sm`. This is the way back to Circles / Docs /
 * Home on a phone: a menu button that drops a full-width panel under the bar.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on Escape; hold body scroll while the panel is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <motion.button
        {...press}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <>
            {/* `absolute`, not `fixed`: the header's backdrop-filter makes it
                the containing block for fixed descendants, which would collapse
                a viewport-anchored overlay to the header's own height. */}
            <motion.div
              className="absolute inset-x-0 top-16 z-20 h-dvh bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              className="absolute inset-x-0 top-16 z-30 border-b border-line bg-bg px-6 pb-3 shadow-2"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {LINKS.map((l) => {
                const active =
                  l.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`${rowClass} ${
                      active ? "font-medium text-ink" : "text-ink-muted"
                    }`}
                  >
                    {l.label}
                    {active ? (
                      <span className="size-1.5 rounded-full bg-accent" />
                    ) : null}
                  </Link>
                );
              })}
              <ThemeRow />
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ThemeRow() {
  const theme = useEffectiveTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${rowClass} w-full text-ink-muted`}
    >
      Switch to {next} mode
      <span className="text-ink-faint">{theme === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 5h12M2 11h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

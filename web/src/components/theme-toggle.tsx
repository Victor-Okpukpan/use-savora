"use client";

import { motion } from "motion/react";

import { press } from "@/lib/motion";
import { toggleTheme, useEffectiveTheme } from "@/lib/theme";

export function ThemeToggle() {
  const theme = useEffectiveTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <motion.button
      {...press}
      onClick={toggleTheme}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-sunk hover:text-ink"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </motion.button>
  );
}

function Sun() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = Math.round((8 + Math.cos(r) * 6) * 100) / 100;
        const y1 = Math.round((8 + Math.sin(r) * 6) * 100) / 100;
        const x2 = Math.round((8 + Math.cos(r) * 7.4) * 100) / 100;
        const y2 = Math.round((8 + Math.sin(r) * 7.4) * 100) / 100;
        return (
          <line
            key={a}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function Moon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

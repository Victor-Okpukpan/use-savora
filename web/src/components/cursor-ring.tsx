"use client";

import { useEffect, useState } from "react";

import { motion, useMotionValue, useSpring } from "motion/react";

type Mode = "idle" | "interactive" | "text" | "press";

const SIZE: Record<Mode, number> = {
  idle: 24,
  interactive: 34,
  text: 6,
  press: 20,
};

const INTERACTIVE = "a, button, [role='button'], label, summary";
const TEXT = "p, h1, h2, h3, h4, span, li, code, pre, input, textarea";

/**
 * A hairline ring that trails the native arrow — texture, plus quiet feedback
 * over anything clickable. Mounted once, at the app root.
 *
 * It only becomes visible after a real mouse move, so it never appears for
 * touch users or keyboard-only users. It also self-disables under
 * `prefers-reduced-motion` and while the window is blurred.
 */
export function CursorRing() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 260, damping: 26, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 260, damping: 26, mass: 0.35 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
      const el = e.target as Element | null;
      if (el?.closest(INTERACTIVE)) setMode("interactive");
      else if (el?.closest(TEXT)) setMode("text");
      else setMode("idle");
    };
    const down = () => setMode("press");
    const up = (e: PointerEvent) => {
      const el = e.target as Element | null;
      setMode(el?.closest(INTERACTIVE) ? "interactive" : "idle");
    };
    const hide = () => setVisible(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, [x, y]);

  const size = SIZE[mode];

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full border border-accent/45"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
        backgroundColor:
          mode === "interactive"
            ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
            : "transparent",
      }}
      animate={{
        width: size,
        height: size,
        opacity: visible ? (mode === "text" ? 0.5 : 1) : 0,
      }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

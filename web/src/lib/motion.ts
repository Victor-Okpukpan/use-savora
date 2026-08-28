import type { Transition, Variants } from "motion/react";

/*
  Near-invisible restraint. Linear's timing discipline: everything is fast,
  small, and opacity-led. Motion smooths a state change and does nothing more —
  no stagger, no counters, no payout celebration. `prefers-reduced-motion` is
  handled globally in CSS and by `MotionConfig reducedMotion="user"`.
*/

export const EASE: Transition["ease"] = [0.25, 0.46, 0.45, 0.94];

export const DURATION = {
  fast: 0.12,
  base: 0.18,
  slow: 0.24,
} as const;

/** Default enter/exit for panels, list rows, dialog content. */
export const fade: Variants = {
  hidden: { opacity: 0, y: 3 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: 3,
    transition: { duration: DURATION.fast, ease: EASE },
  },
};

/** Cross-fade with no travel — for content swaps in place. */
export const crossFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE } },
};

/** Press feedback: opacity and a 1px settle, 120ms. */
export const press = {
  whileHover: { opacity: 0.88 },
  whileTap: { opacity: 0.72, y: 1 },
  transition: { duration: DURATION.fast, ease: EASE },
} as const;

export const spinnerlessPending: Transition = {
  duration: 1.1,
  ease: "linear",
  repeat: Infinity,
};

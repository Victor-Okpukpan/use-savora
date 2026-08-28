import type { Transition, Variants } from "motion/react";

/*
  Two registers.

  APP — near-invisible restraint. Motion smooths a state change and does nothing
  more: no stagger, no counters, no payout celebration. Used everywhere under
  /app and /g.

  MARKETING — scroll-driven and generous. Sections rise on entry, the hero mock
  parallaxes, the headline reveals line by line. Used only on / and /docs.

  `prefers-reduced-motion` collapses both to opacity — handled globally in CSS
  and via <MotionConfig reducedMotion="user">.
*/

// ---- App register ----

export const APP_EASE: Transition["ease"] = [0.25, 0.46, 0.45, 0.94];

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
    transition: { duration: DURATION.base, ease: APP_EASE },
  },
  exit: {
    opacity: 0,
    y: 3,
    transition: { duration: DURATION.fast, ease: APP_EASE },
  },
};

/** Cross-fade with no travel — for content swaps in place. */
export const crossFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: APP_EASE } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: APP_EASE } },
};

/** Press feedback: opacity and a 1px settle, 120ms. */
export const press = {
  whileHover: { opacity: 0.88 },
  whileTap: { opacity: 0.72, y: 1 },
  transition: { duration: DURATION.fast, ease: APP_EASE },
} as const;

// ---- Marketing register ----

export const MKT_EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

export const MKT_DURATION = {
  reveal: 0.52,
  settle: 0.7,
} as const;

/** Rise + fade as a block scrolls into view. The marketing default. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MKT_DURATION.reveal, ease: MKT_EASE },
  },
};

/** Container that staggers `revealVariants` children across a row. */
export const revealGroupVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

/** One line of a headline clip-revealing upward. */
export const lineRevealVariants: Variants = {
  hidden: { y: "110%" },
  visible: {
    y: "0%",
    transition: { duration: MKT_DURATION.settle, ease: MKT_EASE },
  },
};

export const lineRevealGroupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

/** Shared viewport config so every marketing reveal fires the same way. */
export const inViewOnce = { once: true, amount: 0.35 } as const;

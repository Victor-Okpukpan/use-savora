"use client";

import { useRef } from "react";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

import {
  inViewOnce,
  lineRevealGroupVariants,
  lineRevealVariants,
  revealGroupVariants,
  revealVariants,
} from "@/lib/motion";

/**
 * Marketing register — scroll-driven and generous. These four primitives keep
 * the landing/docs motion a system, not per-section improvisation. Every one
 * degrades to a plain opacity fade under `prefers-reduced-motion`.
 */

type DivProps = React.ComponentPropsWithoutRef<typeof motion.div>;

/** Rise + fade as a block scrolls into view. The marketing default wrapper. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header" | "footer";
}) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      transition={{ delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggers `Reveal`-style children across a row. Wrap children in
 * `<RevealItem>` (or any element with `variants={revealVariants}`).
 */
export function RevealGroup({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "section";
}) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      variants={revealGroupVariants}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag className={className} variants={revealVariants}>
      {children}
    </Tag>
  );
}

/**
 * A headline that clip-reveals line by line. Pass the lines explicitly so the
 * break points are deliberate rather than viewport-dependent.
 */
export function LineReveal({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <motion.h1
      className={className}
      variants={lineRevealGroupVariants}
      initial="hidden"
      animate="visible"
    >
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span className="block" variants={lineRevealVariants}>
            {line}
          </motion.span>
        </span>
      ))}
    </motion.h1>
  );
}

/**
 * Drifts its content against the scroll. `range` is the translate span in px
 * across the element's full pass through the viewport.
 */
export function Parallax({
  children,
  range = 40,
  className,
  ...rest
}: {
  children: React.ReactNode;
  range?: number;
  className?: string;
} & DivProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [range, -range]);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={reduce ? undefined : { y }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

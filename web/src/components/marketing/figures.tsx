"use client";

import { motion } from "motion/react";

import { inViewOnce, MKT_EASE } from "@/lib/motion";

/*
  Isometric line-art in the FIG 0.x technical-drawing register. Each figure's
  strokes draw themselves in as it scrolls into view; under reduced motion they
  simply appear. Stroke-only, palette-only — no fill, no glow.
*/

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.9, ease: MKT_EASE, delay: i * 0.12 },
      opacity: { duration: 0.2, delay: i * 0.12 },
    },
  }),
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <motion.svg
      viewBox="0 0 200 150"
      className="h-auto w-full max-w-[280px] overflow-visible text-ink-faint"
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </motion.svg>
  );
}

/** FIG 0.1 — the vault. A closed isometric box with no keyhole. */
export function FigVault() {
  return (
    <Svg>
      {/* top face */}
      <motion.path custom={0} variants={draw} d="M100 30 L160 60 L100 90 L40 60 Z" />
      {/* left face */}
      <motion.path custom={1} variants={draw} d="M40 60 L40 100 L100 130 L100 90 Z" />
      {/* right face */}
      <motion.path custom={2} variants={draw} d="M160 60 L160 100 L100 130 L100 90 Z" />
      {/* stacked-coin division lines on the faces */}
      <motion.path custom={3} variants={draw} d="M40 73 L100 103 L160 73" />
      <motion.path custom={3} variants={draw} d="M40 86 L100 116 L160 86" />
      {/* the seal: a ring on the front seam, deliberately with no keyhole */}
      <motion.circle
        custom={4}
        variants={draw}
        cx="100"
        cy="100"
        r="7"
        stroke="var(--color-accent)"
      />
    </Svg>
  );
}

/** FIG 0.2 — the shuffle. Tokens on a track, connected in a fixed order. */
export function FigShuffle() {
  const xs = [30, 70, 110, 150];
  return (
    <Svg>
      <motion.path
        custom={0}
        variants={draw}
        d="M20 100 L180 100"
        stroke="var(--color-line-strong)"
      />
      {xs.map((x, i) => (
        <motion.path
          key={x}
          custom={1 + i}
          variants={draw}
          d={`M${x} 90 l12 7 l-12 7 l-12 -7 Z`}
          stroke={i === 1 ? "var(--color-accent)" : "var(--color-line-strong)"}
        />
      ))}
      {/* order arcs, drawn last */}
      <motion.path custom={5} variants={draw} d="M42 88 C 55 55, 85 55, 98 86" />
      <motion.path custom={6} variants={draw} d="M122 88 C 135 60, 158 60, 168 86" />
      <motion.path
        custom={7}
        variants={draw}
        d="M82 92 C 95 118, 118 118, 128 94"
      />
    </Svg>
  );
}

/** FIG 0.3 — the rotation. A ring of members, one collecting, the pool centred. */
export function FigRotation() {
  const cx = 100;
  const cy = 75;
  const r = 45;
  const n = 6;
  const q = (v: number) => Math.round(v * 1000) / 1000;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      x: q(cx + r * Math.cos(a)),
      y: q(cy + r * Math.sin(a)),
      active: i === 1,
    };
  });
  return (
    <Svg>
      <motion.circle
        custom={0}
        variants={draw}
        cx={cx}
        cy={cy}
        r={r}
        stroke="var(--color-line-strong)"
      />
      <motion.circle
        custom={1}
        variants={draw}
        cx={cx}
        cy={cy}
        r="13"
        stroke="var(--color-line-strong)"
      />
      <motion.path
        custom={2}
        variants={draw}
        d={`M${cx} ${cy} L${nodes[1].x} ${nodes[1].y}`}
        stroke="var(--color-accent)"
      />
      {nodes.map((nd, i) => (
        <motion.circle
          key={i}
          custom={3 + i}
          variants={draw}
          cx={nd.x}
          cy={nd.y}
          r={nd.active ? 6 : 4}
          stroke={nd.active ? "var(--color-accent)" : "var(--color-line-strong)"}
        />
      ))}
    </Svg>
  );
}

export function Figure({
  n,
  title,
  caption,
  children,
}: {
  n: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 px-6 py-10 lg:px-9 lg:py-12">
      <span className="micro">FIG {n}</span>
      <div className="flex min-h-[180px] items-center justify-center">
        {children}
      </div>
      <div>
        <h3 className="text-[15px] font-medium text-ink">{title}</h3>
        <p className="mt-2 max-w-[36ch] text-[13px] leading-[1.6] text-ink-muted">
          {caption}
        </p>
      </div>
    </div>
  );
}

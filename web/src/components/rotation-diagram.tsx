/*
  A quiet, literal picture of the mechanism: members on a ring, the pool in the
  middle, one member collecting this turn. Geometric and static — no glow, no
  gradient, no motion. Decorative only in that it fills the hero; it still says
  something true about how ajo works.
*/
export function RotationDiagram() {
  const n = 6;
  const active = 1;
  const r = 92;
  const c = 130;
  const nodes = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle), i };
  });

  return (
    <svg
      viewBox="0 0 260 260"
      className="h-auto w-full max-w-[340px] text-ink"
      role="img"
      aria-label="A savings circle: members around a ring, the pool in the middle, one member collecting this round."
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth="1"
      />

      {/* the pool */}
      <circle
        cx={c}
        cy={c}
        r="26"
        fill="none"
        stroke="var(--color-line-strong)"
        strokeWidth="1"
      />
      <text
        x={c}
        y={c + 4}
        textAnchor="middle"
        className="tnum"
        fontSize="12"
        fill="var(--color-ink-muted)"
      >
        pool
      </text>

      {/* payout line to the collecting member */}
      <line
        x1={c}
        y1={c}
        x2={nodes[active].x}
        y2={nodes[active].y}
        stroke="var(--color-accent)"
        strokeWidth="1.25"
      />

      {nodes.map((node) => {
        const isActive = node.i === active;
        return (
          <g key={node.i}>
            <circle
              cx={node.x}
              cy={node.y}
              r={isActive ? 9 : 6}
              fill={isActive ? "var(--color-accent)" : "var(--color-bg)"}
              stroke={
                isActive ? "var(--color-accent)" : "var(--color-line-strong)"
              }
              strokeWidth="1.25"
            />
          </g>
        );
      })}
    </svg>
  );
}

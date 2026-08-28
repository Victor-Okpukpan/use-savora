import { formatUsdc } from "@/lib/savora/format";
import type { Position } from "@/lib/savora/position";

const TURN_TEXT: Record<Position["turnState"], string> = {
  collected: "collected",
  now: "your turn now",
  upcoming: "upcoming",
  forming: "set at seal",
};

/** The four questions a member actually has about a circle. */
export function PositionSummary({ position }: { position: Position }) {
  const cells = [
    {
      label: "Contributed",
      value: `${formatUsdc(position.contributed, { fixed: true })}`,
      sub: "USDC so far",
    },
    {
      label: "You collect",
      value: `${formatUsdc(position.collect, { fixed: true })}`,
      sub: "USDC, on your turn",
    },
    {
      label: "Your turn",
      value:
        position.turnRound != null ? `Round ${position.turnRound}` : "—",
      sub: TURN_TEXT[position.turnState],
    },
    {
      label: "Still owed",
      value: `${formatUsdc(position.remaining, { fixed: true })}`,
      sub: "USDC over the rotation",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1.5 bg-surface p-4">
          <span className="micro">{c.label}</span>
          <span
            className={`tnum text-[19px] leading-none ${
              c.label === "Your turn" && position.turnState === "now"
                ? "text-accent"
                : "text-ink"
            }`}
          >
            {c.value}
          </span>
          <span className="text-[11px] text-ink-muted">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}

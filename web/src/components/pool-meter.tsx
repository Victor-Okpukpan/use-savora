import { formatUsdc } from "@/lib/savora/format";

/**
 * The current round's pool filling toward its target. App register: the bar
 * eases on data change (a state-change smoothing), the figure does not count.
 */
export function PoolMeter({
  pooled,
  target,
  paidCount,
  need,
  short = false,
}: {
  pooled: bigint;
  target: bigint;
  paidCount: number;
  /** How many members must contribute this round (recipient excluded). */
  need: number;
  short?: boolean;
}) {
  const pct =
    target > 0n ? Math.min(100, Number((pooled * 10000n) / target) / 100) : 0;
  const dots = Math.max(0, need);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="tnum text-[26px] leading-none text-ink">
          {formatUsdc(pooled, { fixed: true })}
          <span className="ml-1.5 text-[13px] text-ink-faint">USDC</span>
        </span>
        {!short ? (
          <span className="tnum text-[12px] text-ink-muted">
            of {formatUsdc(target, { fixed: true })}
          </span>
        ) : null}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunk">
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-(--duration-slow) ease-app"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: dots }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i < paidCount ? "bg-accent" : "bg-line-strong"
              }`}
            />
          ))}
        </div>
        <span className="tnum text-[12px] text-ink-muted">
          {paidCount} of {dots} paid
        </span>
      </div>
    </div>
  );
}

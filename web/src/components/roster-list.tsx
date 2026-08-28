"use client";

import type { Address, ReadonlyUint8Array } from "@solana/kit";

import { shortAddress } from "@/lib/savora/format";

/**
 * Members in rotation order — the sequence in which they collect. Each row
 * shows the round they take, whether they've paid the current round, and any
 * missed contributions (permanent, enforced socially).
 */
export function RosterList({
  members,
  rotation,
  missed,
  memberCount,
  status,
  currentCycle,
  me,
  contributedMask,
}: {
  members: Address[];
  rotation: ReadonlyUint8Array | number[];
  missed: ReadonlyArray<number>;
  memberCount: number;
  status: number;
  currentCycle: number;
  me: string;
  contributedMask: number;
}) {
  const order =
    status === 0
      ? members.map((_, i) => i)
      : Array.from({ length: memberCount }, (_, round) => rotation[round]);

  return (
    <section>
      <h2 className="mb-2 text-[13px] font-medium text-ink">
        {status === 0 ? "Members" : "Collection order"}
      </h2>
      <ol className="overflow-hidden rounded-card border border-line">
        {order.map((memberIndex, round) => {
          const addr = members[memberIndex];
          const isMe = addr === me;
          const isNext = status === 1 && round === currentCycle;
          const isPast = status === 1 && round < currentCycle;
          const paid = (contributedMask & (1 << memberIndex)) !== 0;
          const miss = missed[memberIndex] ?? 0;

          const rightLabel = isPast
            ? "collected"
            : isNext
              ? "collects now"
              : null;

          return (
            <li
              key={addr}
              className={`flex items-center gap-3 border-b border-line px-4 py-3 text-[13px] last:border-0 ${
                isNext ? "bg-surface-sunk" : ""
              }`}
            >
              <span
                className={`tnum w-5 shrink-0 text-right text-[12px] ${
                  isPast ? "text-ink-faint" : "text-ink-muted"
                }`}
              >
                {status === 0 ? "·" : round + 1}
              </span>

              {/* current-round payment status, as a quiet dot */}
              {status === 1 && !isPast ? (
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full ${
                    round === currentCycle
                      ? paid
                        ? "bg-positive"
                        : "bg-line-strong"
                      : "bg-transparent"
                  }`}
                />
              ) : null}

              <span
                className={`addr min-w-0 flex-1 truncate ${
                  isPast ? "text-ink-muted" : "text-ink"
                }`}
              >
                {shortAddress(addr)}
                {isMe ? (
                  <span className="ml-2 text-[11px] text-ink-faint">you</span>
                ) : null}
              </span>

              {miss > 0 ? (
                <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-warning">
                  {miss}× missed
                </span>
              ) : null}

              {rightLabel ? (
                <span
                  className={`shrink-0 text-[11px] ${
                    isNext ? "font-medium text-accent" : "text-ink-faint"
                  }`}
                >
                  {rightLabel}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

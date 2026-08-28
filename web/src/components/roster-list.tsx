"use client";

import type { Address, ReadonlyUint8Array } from "@solana/kit";

import { MemberIdentity } from "./member-identity";

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
  labels,
  editableNicknames = false,
}: {
  members: Address[];
  rotation: ReadonlyUint8Array | number[];
  missed: ReadonlyArray<number>;
  memberCount: number;
  status: number;
  currentCycle: number;
  me: string;
  contributedMask: number;
  /** Display names by member index (demo fixtures only). */
  labels?: (string | undefined)[];
  editableNicknames?: boolean;
}) {
  const order =
    status === 0
      ? members.map((_, i) => i)
      : Array.from({ length: memberCount }, (_, round) => rotation[round]);

  return (
    <section>
      <h2 className="micro mb-2.5">
        {status === 0 ? "Members" : "Collection order"}
      </h2>
      <ol className="overflow-hidden rounded-card border border-line bg-surface">
        {order.map((memberIndex, round) => {
          const addr = members[memberIndex];
          const isMe = addr === me;
          const isNext = status === 1 && round === currentCycle;
          const isPast = status !== 0 && (status === 2 || round < currentCycle);
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
              className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${
                isNext ? "bg-accent/4" : ""
              }`}
            >
              <span
                className={`micro w-6 shrink-0 text-right ${
                  isPast ? "opacity-60" : ""
                }`}
              >
                {status === 0 ? "·" : round + 1}
              </span>

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
                  title={
                    round === currentCycle
                      ? paid
                        ? "paid this round"
                        : "not yet paid"
                      : undefined
                  }
                />
              ) : null}

              <MemberIdentity
                address={addr}
                you={isMe}
                label={labels?.[memberIndex]}
                editable={editableNicknames && !isMe}
                className={`flex-1 ${isPast ? "opacity-70" : ""}`}
              />

              {miss > 0 ? (
                <span className="shrink-0 rounded-pill border border-line px-1.5 py-0.5 text-[11px] text-warning">
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

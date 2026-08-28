"use client";

import type { Address } from "@solana/kit";

import type { Group } from "@/generated";
import {
  GroupStatus,
  isDefaulted,
  isEjected,
  rotationSlotPosition,
  seatAddresses,
} from "@/lib/savora/group";
import { MemberIdentity } from "./member-identity";

/**
 * Everyone in the circle. While a rotation runs, live members are ordered by
 * when they collect; ejected members are listed after, marked. Each row shows
 * the round they take, whether they've settled the current round, and whether
 * they were ejected for a miss.
 */
export function RosterList({
  group: g,
  me,
  contributedMask,
  requiredMask,
  labels,
  editableNicknames = false,
}: {
  group: Group;
  me: string;
  contributedMask: number;
  requiredMask: number;
  labels?: (string | undefined)[];
  editableNicknames?: boolean;
}) {
  const members = seatAddresses(g);
  const forming = g.status === GroupStatus.Forming;
  const running = g.status === GroupStatus.Active;

  // Order: forming -> join order. Otherwise -> rotation order for live members
  // (by their position this rotation), ejected members last.
  const order = forming
    ? members.map((_, i) => i)
    : [...members.keys()].sort((a, b) => {
        const ea = isEjected(g, a) ? 1 : 0;
        const eb = isEjected(g, b) ? 1 : 0;
        if (ea !== eb) return ea - eb;
        const pa = rotationSlotPosition(g, a) ?? 99;
        const pb = rotationSlotPosition(g, b) ?? 99;
        return pa - pb;
      });

  return (
    <section>
      <h2 className="micro mb-2.5">
        {forming ? "Members" : "Collection order"}
      </h2>
      <ol className="overflow-hidden rounded-card border border-line bg-surface">
        {order.map((memberIndex) => {
          const addr = members[memberIndex] as Address;
          const isMe = addr === me;
          const ejected = isEjected(g, memberIndex);
          const defaulted = isDefaulted(g, memberIndex);
          const pos = ejected ? null : rotationSlotPosition(g, memberIndex);
          const isNow = running && pos === g.rotationPos + 1;
          const isPast =
            !ejected &&
            !forming &&
            (g.status === GroupStatus.Completed ||
              (pos != null && pos <= g.rotationPos));

          const owesThisRound =
            (requiredMask & (1 << memberIndex)) !== 0 &&
            memberIndex !== -1;
          const settled = (contributedMask & (1 << memberIndex)) !== 0;

          const rightLabel = ejected
            ? defaulted
              ? "ejected"
              : "left"
            : isPast
              ? "collected"
              : isNow
                ? "collects now"
                : null;

          return (
            <li
              key={addr}
              className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${
                isNow ? "bg-accent/4" : ""
              } ${ejected ? "opacity-55" : ""}`}
            >
              <span
                className={`micro w-6 shrink-0 text-right ${
                  isPast ? "opacity-60" : ""
                }`}
              >
                {forming || pos == null ? "·" : pos}
              </span>

              {running && !isNow && !isPast && !ejected && owesThisRound ? (
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full ${
                    settled ? "bg-positive" : "bg-line-strong"
                  }`}
                  title={settled ? "paid this round" : "not yet paid"}
                />
              ) : (
                <span className="size-1.5 shrink-0" />
              )}

              <MemberIdentity
                address={addr}
                you={isMe}
                label={labels?.[memberIndex]}
                editable={editableNicknames && !isMe}
                className={`flex-1 ${isPast || ejected ? "opacity-70" : ""}`}
              />

              {defaulted ? (
                <span className="shrink-0 rounded-pill border border-line px-1.5 py-0.5 text-[11px] text-danger">
                  missed a round
                </span>
              ) : null}

              {rightLabel ? (
                <span
                  className={`shrink-0 text-[11px] ${
                    isNow ? "font-medium text-accent" : "text-ink-faint"
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

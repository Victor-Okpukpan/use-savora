import type { ReadonlyUint8Array } from "@solana/kit";

import { shortAddress } from "@/lib/savora/format";
import { MemberMark } from "./member-identity";

/**
 * Every round in the current rotation, left to right: who collects, and where
 * the circle is now. Answers "when is my turn" at a glance.
 */
export function RotationTrack({
  members,
  rotation,
  rotationLen,
  rotationPos,
  active,
  me,
  labels,
}: {
  members: string[];
  rotation: ReadonlyUint8Array | number[];
  rotationLen: number;
  rotationPos: number;
  active: boolean;
  me?: string;
  /** Optional display names by member index (demo fixtures). */
  labels?: (string | undefined)[];
}) {
  const rounds = Array.from({ length: rotationLen }, (_, i) => {
    const memberIndex = rotation[i];
    return { round: i, memberIndex, address: members[memberIndex] };
  });

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {rounds.map(({ round, memberIndex, address }) => {
        const done = !active || round < rotationPos;
        const now = active && round === rotationPos;
        const mine = address === me;
        const label = labels?.[memberIndex] ?? shortAddress(address, 4, 4);

        return (
          <div
            key={round}
            className={`flex min-w-[104px] flex-1 flex-col gap-2 rounded-card border p-3 ${
              now ? "border-accent/40 bg-accent/4" : "border-line bg-raised"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="micro">R{round + 1}</span>
              {done ? (
                <span className="text-[10px] text-ink-faint">✓</span>
              ) : now ? (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </div>
            <MemberMark address={address} size={24} />
            <span
              className={`truncate text-[12px] ${
                done ? "text-ink-faint" : now ? "text-ink" : "text-ink-muted"
              }`}
            >
              {label}
              {mine ? (
                <span className="ml-1 text-[10px] text-ink-faint">you</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

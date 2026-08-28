import { rotationPosition } from "./format";
import type { GroupAccount, CycleAccount } from "./queries";

/** What a member has put in and what they're owed, for one circle. */
export type Position = {
  memberIndex: number;
  /** USDC contributed across all rounds so far. */
  contributed: bigint;
  /** Full pool the member collects on their turn (nominal). */
  collect: bigint;
  /** 1-based round the member collects in. */
  turnRound: number | null;
  /** "collected" | "now" | "upcoming" | "forming" */
  turnState: "collected" | "now" | "upcoming" | "forming";
  /** USDC still owed across the rest of the rotation. */
  remaining: bigint;
};

export function computePosition(
  group: GroupAccount,
  cycles: CycleAccount[],
  me: string,
): Position | null {
  const g = group.data;
  const memberIndex = g.members.slice(0, g.memberCount).indexOf(me as never);
  if (memberIndex < 0) return null;

  const bit = 1 << memberIndex;
  let roundsPaid = 0;
  for (const c of cycles) {
    if ((c.data.contributed & bit) !== 0) roundsPaid++;
  }
  const contributed = g.contribution * BigInt(roundsPaid);
  const collect = g.contribution * BigInt(g.memberCount);

  const turnRound =
    g.status === 0
      ? null
      : rotationPosition(g.rotation, memberIndex, g.memberCount);

  let turnState: Position["turnState"] = "forming";
  if (g.status !== 0 && turnRound != null) {
    if (g.status === 2 || turnRound - 1 < g.currentCycle) turnState = "collected";
    else if (turnRound - 1 === g.currentCycle) turnState = "now";
    else turnState = "upcoming";
  }

  const roundsLeft = Math.max(0, g.memberCount - roundsPaid);
  const remaining = g.contribution * BigInt(roundsLeft);

  return { memberIndex, contributed, collect, turnRound, turnState, remaining };
}

export type AggregatePosition = {
  circles: number;
  contributed: bigint;
  remaining: bigint;
  /** Nearest upcoming turn across all circles, if any. */
  nextTurn: { name: string; state: Position["turnState"] } | null;
};

export function aggregatePositions(
  entries: { group: GroupAccount; position: Position | null; name: string }[],
): AggregatePosition {
  let contributed = 0n;
  let remaining = 0n;
  let nextTurn: AggregatePosition["nextTurn"] = null;
  let circles = 0;

  for (const { position, name } of entries) {
    if (!position) continue;
    circles++;
    contributed += position.contributed;
    remaining += position.remaining;
    if (position.turnState === "now") {
      nextTurn = { name, state: "now" };
    } else if (position.turnState === "upcoming" && !nextTurn) {
      nextTurn = { name, state: "upcoming" };
    }
  }

  return { circles, contributed, remaining, nextTurn };
}

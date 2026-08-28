import { decodeName, rotationPosition } from "./format";
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

/**
 * A member's reliability record across every circle they're in. Derived from
 * `Group` accounts alone — no extra RPC:
 *
 *   roundsClosed  = group.current_cycle          (disbursed cycles)
 *   missed        = group.missed[myIndex]         (permanent onchain counter)
 *   paid          = roundsClosed − missed
 *
 * `contributed` is exact: the program enforces the exact contribution amount,
 * so a paid round is always `group.contribution`. `collected` is *not*
 * derivable here (a payout can be short when others miss), so it is reported
 * as turns taken, not a USDC figure.
 */
export type Record = {
  circlesActive: number;
  circlesCompleted: number;
  circlesForming: number;
  roundsPaid: number;
  roundsMissed: number;
  turnsTaken: number;
  contributed: bigint;
  /** Circles where I've missed at least one round, for a "where" line. */
  blemishes: { name: string; missed: number }[];
};

export function computeRecord(groups: GroupAccount[], me: string): Record {
  const r: Record = {
    circlesActive: 0,
    circlesCompleted: 0,
    circlesForming: 0,
    roundsPaid: 0,
    roundsMissed: 0,
    turnsTaken: 0,
    contributed: 0n,
    blemishes: [],
  };

  for (const group of groups) {
    const g = group.data;
    const idx = g.members.slice(0, g.memberCount).indexOf(me as never);
    if (idx < 0) continue;

    if (g.status === 0) {
      r.circlesForming++;
      continue;
    }
    if (g.status === 1) r.circlesActive++;
    if (g.status === 2) r.circlesCompleted++;

    const roundsClosed = g.currentCycle;
    const missed = g.missed[idx] ?? 0;
    const paid = Math.max(0, roundsClosed - missed);

    r.roundsPaid += paid;
    r.roundsMissed += missed;
    r.contributed += g.contribution * BigInt(paid);
    if (missed > 0) {
      r.blemishes.push({ name: decodeName(g.name), missed });
    }

    const pos = rotationPosition(g.rotation, idx, g.memberCount);
    if (pos != null && (g.status === 2 || pos - 1 < g.currentCycle)) {
      r.turnsTaken++;
    }
  }

  return r;
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

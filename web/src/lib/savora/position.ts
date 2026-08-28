import { decodeName } from "./format";
import {
  GroupStatus,
  isDefaulted,
  isEjected,
  roundTarget,
  rotationSlotPosition,
  slotOf,
} from "./group";
import type { GroupAccount, CycleAccount } from "./queries";

/** What a member has put in and what they're owed, for one circle. */
export type Position = {
  memberIndex: number;
  /** Contributed across every round recorded so far (exact). */
  contributed: bigint;
  /** Refundable security deposit still parked in the vault. */
  deposit: bigint;
  /** Nominal pot the member collects on their turn (at the current size). */
  collect: bigint;
  /** 1-based round the member collects in, within the current rotation. */
  turnRound: number | null;
  turnState: "collected" | "now" | "upcoming" | "forming" | "ejected";
  /** Still owed across the rest of this rotation (upper bound). */
  remaining: bigint;
  ejected: boolean;
  defaulted: boolean;
};

export function computePosition(
  group: GroupAccount,
  cycles: CycleAccount[],
  me: string,
): Position | null {
  const g = group.data;
  const memberIndex = slotOf(g, me);
  if (memberIndex < 0) return null;

  const bit = 1 << memberIndex;
  let roundsPaid = 0;
  for (const c of cycles) {
    // paid = my bit set AND I wasn't just the pre-set recipient that round
    if (
      (c.data.contributed & bit) !== 0 &&
      c.data.recipientIndex !== memberIndex
    ) {
      roundsPaid++;
    }
  }
  const contributed = g.contribution * BigInt(roundsPaid);
  const collect = roundTarget(g);
  const ejected = isEjected(g, memberIndex);

  const turnRound =
    g.status === GroupStatus.Forming || ejected
      ? null
      : rotationSlotPosition(g, memberIndex);

  let turnState: Position["turnState"] = "forming";
  if (ejected) {
    turnState = "ejected";
  } else if (g.status === GroupStatus.Completed) {
    turnState = "collected";
  } else if (g.status !== GroupStatus.Forming && turnRound != null) {
    const pos = g.rotationPos + 1;
    if (turnRound < pos) turnState = "collected";
    else if (turnRound === pos) turnState = "now";
    else turnState = "upcoming";
  }

  // Rounds left in this rotation that I actually owe — I pay every remaining
  // round except the one where I collect.
  const roundsRemaining = Math.max(0, g.rotationLen - g.rotationPos);
  const myTurnStillToCome =
    turnRound != null && turnRound >= g.rotationPos + 1;
  const roundsLeft =
    ejected || g.status !== GroupStatus.Active
      ? 0
      : Math.max(0, roundsRemaining - (myTurnStillToCome ? 1 : 0));
  const remaining = g.contribution * BigInt(roundsLeft);

  return {
    memberIndex,
    contributed,
    deposit: ejected ? 0n : g.deposit,
    collect,
    turnRound,
    turnState,
    remaining,
    ejected,
    defaulted: isDefaulted(g, memberIndex),
  };
}

/**
 * A member's reliability record across every circle they're in — derived from
 * `Group` accounts alone, no extra RPC. What the chain records now is coarse:
 * a member either stays live (paid every round) or is ejected on their first
 * miss. So the honest figures are turns collected and times ejected.
 */
export type Record = {
  circlesActive: number;
  circlesCompleted: number;
  circlesForming: number;
  turnsTaken: number;
  timesEjected: number;
  /** Never ejected from any circle they've been in. */
  clean: boolean;
  /** Circle names where they were ejected. */
  blemishes: string[];
};

export function computeRecord(groups: GroupAccount[], me: string): Record {
  const r: Record = {
    circlesActive: 0,
    circlesCompleted: 0,
    circlesForming: 0,
    turnsTaken: 0,
    timesEjected: 0,
    clean: true,
    blemishes: [],
  };

  for (const group of groups) {
    const g = group.data;
    const idx = slotOf(g, me);
    if (idx < 0) continue;

    if (g.status === GroupStatus.Forming) {
      r.circlesForming++;
      continue;
    }
    if (g.status === GroupStatus.Completed) r.circlesCompleted++;
    else r.circlesActive++; // Active | Extending | Failed

    if (isDefaulted(g, idx)) {
      r.timesEjected++;
      r.clean = false;
      r.blemishes.push(decodeName(g.name) || "a circle");
    }

    // full rotations behind us, plus this rotation's turn if it's already past
    let turns = g.rotationsDone;
    if (g.status === GroupStatus.Active) {
      const pos = rotationSlotPosition(g, idx);
      if (pos != null && pos <= g.rotationPos) turns += 1;
    }
    r.turnsTaken += turns;
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

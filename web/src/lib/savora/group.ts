import type { Address, ReadonlyUint8Array } from "@solana/kit";

import type { Cycle, Group } from "@/generated";

/** Numeric GroupStatus discriminants, matching the program enum order. */
export const GroupStatus = {
  Forming: 0,
  Active: 1,
  Completed: 2,
  Extending: 3,
  Failed: 4,
} as const;

export const STATUS_LABEL = [
  "Forming",
  "Active",
  "Completed",
  "Extending",
  "Failed",
] as const;

export function popcount(n: number): number {
  let c = 0;
  let x = n & 0xffff;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** Bitmask of every assigned seat. */
export function seatMask(g: Group): number {
  return g.seatCount === 0 ? 0 : (1 << g.seatCount) - 1;
}

/** Seats still in the circle: assigned and not ejected. */
export function liveMask(g: Group): number {
  return seatMask(g) & ~g.ejected;
}

/** People who currently owe a contribution and collect a payout. */
export function activeCount(g: Group): number {
  return popcount(liveMask(g));
}

export function isEjected(g: Group, i: number): boolean {
  return (g.ejected & (1 << i)) !== 0;
}

export function isDefaulted(g: Group, i: number): boolean {
  return (g.defaulted & (1 << i)) !== 0;
}

export function isLive(g: Group, i: number): boolean {
  return (liveMask(g) & (1 << i)) !== 0;
}

/** Assigned member slots as addresses (index 0..seatCount-1). */
export function seatAddresses(g: Group): Address[] {
  return g.members.slice(0, g.seatCount) as Address[];
}

/** Index of `addr` in the roster, or -1. */
export function slotOf(g: Group, addr: string): number {
  return seatAddresses(g).findIndex((m) => m === addr);
}

/** The full pot a round pays out when everyone contributes (recipient excluded). */
export function roundTarget(g: Group): bigint {
  const n = activeCount(g);
  return n > 1 ? g.contribution * BigInt(n - 1) : 0n;
}

/** How many required members have settled this cycle (excludes the recipient). */
export function paidCount(c: Cycle): number {
  return popcount(c.contributed & c.required & ~(1 << c.recipientIndex));
}

/** How many members still owe this cycle. */
export function owingCount(c: Cycle): number {
  return popcount(c.required & ~c.contributed);
}

export function isFullyFunded(c: Cycle): boolean {
  return c.contributed === c.required;
}

/**
 * Rotation position (1-based) of member slot `i` in the *current* rotation, or
 * null if they are not in it (ejected, or not yet placed).
 */
export function rotationSlotPosition(g: Group, i: number): number | null {
  for (let p = 0; p < g.rotationLen; p++) {
    if (g.rotation[p] === i) return p + 1;
  }
  return null;
}

/**
 * Where the circle is in its overall run, for display.
 * `rotation` is 1-based rotation number; `round` is 1-based within it.
 */
export function schedule(g: Group) {
  return {
    rotation: g.rotationsDone + 1,
    rotationsTotal: g.rotationsTarget,
    round: g.rotationPos + 1,
    roundsThisRotation: g.rotationLen,
    globalRound: g.currentCycle + 1,
  };
}

export type RoundPhase =
  | { kind: "none" }
  | { kind: "open"; deadline: number; graceEnd: number }
  | { kind: "grace"; graceEnd: number }
  | { kind: "payable" }
  | { kind: "disbursed" };

export function roundPhase(
  g: Group,
  c: Cycle | null,
  nowSec: number,
): RoundPhase {
  if (!c) return { kind: "none" };
  if (c.disbursed) return { kind: "disbursed" };
  const deadline = Number(c.deadline);
  const graceEnd = deadline + Number(g.graceSecs);
  if (isFullyFunded(c)) return { kind: "payable" };
  if (nowSec <= deadline) return { kind: "open", deadline, graceEnd };
  if (nowSec <= graceEnd) return { kind: "grace", graceEnd };
  return { kind: "payable" };
}

/** rotation as a plain number[] regardless of decoder representation. */
export function rotationArray(
  rotation: ReadonlyUint8Array | Uint8Array | number[],
): number[] {
  return Array.from(rotation as ArrayLike<number>);
}

import { GroupStatus, paidCount, popcount } from "./group";
import type { GroupAccount, CycleAccount } from "./queries";

/**
 * Events reconstructed from what the chain actually records. The program does
 * not timestamp individual contributions, so the feed is round-grained, not
 * minute-grained — no invented "2h ago".
 */
export type ActivityEvent = {
  key: string;
  kind:
    | "formed"
    | "sealed"
    | "paid"
    | "closed"
    | "open"
    | "ejected"
    | "completed"
    | "failed";
  round?: number;
  /** Member index this event concerns, if any. */
  memberIndex?: number;
  amount?: bigint;
  text: string;
  /** Account address to open on the explorer, if the event has one. */
  ref?: string;
};

export function deriveActivity(
  group: GroupAccount,
  cycles: CycleAccount[],
): ActivityEvent[] {
  const g = group.data;
  const out: ActivityEvent[] = [];

  if (g.status === GroupStatus.Completed) {
    out.push({
      key: "completed",
      kind: "completed",
      text:
        g.rotationsDone > 1
          ? `All ${g.rotationsDone} rotations complete`
          : "Every member has collected — the circle is complete",
      ref: group.address,
    });
  }
  if (g.status === GroupStatus.Failed) {
    out.push({
      key: "failed",
      kind: "failed",
      text: "The circle collapsed — too few active members to continue",
      ref: group.address,
    });
  }

  // `cycles` arrives newest-first from getCycleHistory.
  for (const c of cycles) {
    const d = c.data;
    const roundNo = d.index + 1;
    const need = Math.max(0, popcount(d.required) - 1); // recipient owes nothing

    if (d.ejectedHere !== 0) {
      const slots: number[] = [];
      for (let i = 0; i < 12; i++) if (d.ejectedHere & (1 << i)) slots.push(i);
      for (const s of slots) {
        out.push({
          key: `ejected-${d.index}-${s}`,
          kind: "ejected",
          round: d.index,
          memberIndex: s,
          text: `missed round ${roundNo} — ejected, deposit forfeited`,
          ref: c.address,
        });
      }
    }

    if (d.disbursed) {
      out.push({
        key: `paid-${d.index}`,
        kind: "paid",
        round: d.index,
        memberIndex: d.recipientIndex,
        amount: d.payout,
        text: `Round ${roundNo} paid out`,
        ref: c.address,
      });
      out.push({
        key: `closed-${d.index}`,
        kind: "closed",
        round: d.index,
        text: `Round ${roundNo} closed · ${paidCount(d)}/${need} contributed`,
        ref: c.address,
      });
    } else {
      out.push({
        key: `open-${d.index}`,
        kind: "open",
        round: d.index,
        text: `Round ${roundNo} open · ${paidCount(d)}/${need} contributed`,
        ref: c.address,
      });
    }
  }

  if (g.status !== GroupStatus.Forming) {
    out.push({
      key: "sealed",
      kind: "sealed",
      text: "Circle sealed · collection order fixed onchain",
      ref: group.address,
    });
  }

  // Always the oldest event: the circle exists from the moment it's created.
  out.push({
    key: "formed",
    kind: "formed",
    text:
      g.status === GroupStatus.Forming
        ? `Circle created · ${g.seatCount}/${g.capacity} seats filled`
        : "Circle created",
    ref: group.address,
  });

  return out;
}

/** How many members have been ejected for a missed contribution. */
export function totalDefaulted(group: GroupAccount): number {
  return popcount(group.data.defaulted);
}

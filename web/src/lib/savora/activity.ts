import type { GroupAccount, CycleAccount } from "./queries";

/**
 * Events reconstructed from what the chain actually records. The program does
 * not timestamp individual contributions, so the feed is round-grained, not
 * minute-grained — no invented "2h ago".
 */
export type ActivityEvent = {
  key: string;
  kind: "sealed" | "paid" | "closed" | "open" | "missed" | "completed";
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

  if (g.status === 2) {
    out.push({
      key: "completed",
      kind: "completed",
      text: "Every member has collected — the circle is complete",
      ref: group.address,
    });
  }

  // `cycles` arrives newest-first from getCycleHistory.
  for (const c of cycles) {
    const round = c.data.index;
    const collector = c.data.recipientIndex;

    if (c.data.disbursed) {
      out.push({
        key: `paid-${round}`,
        kind: "paid",
        round,
        memberIndex: collector,
        amount: c.data.payout,
        text: `Round ${round + 1} paid out`,
        ref: c.address,
      });
      out.push({
        key: `closed-${round}`,
        kind: "closed",
        round,
        text: `Round ${round + 1} closed · ${c.data.contributorCount}/${g.memberCount} contributed`,
        ref: c.address,
      });
    } else {
      out.push({
        key: `open-${round}`,
        kind: "open",
        round,
        text: `Round ${round + 1} open · ${c.data.contributorCount}/${g.memberCount} contributed`,
        ref: c.address,
      });
    }
  }

  if (g.status !== 0) {
    out.push({
      key: "sealed",
      kind: "sealed",
      text: "Circle sealed · collection order fixed onchain",
      ref: group.address,
    });
  }

  return out;
}

/** Total missed contributions across the whole circle, for a summary line. */
export function totalMissed(group: GroupAccount): number {
  return group.data.missed
    .slice(0, group.data.memberCount)
    .reduce((a, b) => a + b, 0);
}

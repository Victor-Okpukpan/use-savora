import { cache } from "react";

import type { Address } from "@solana/kit";

import { fetchMaybeGroup } from "@/generated";
import { DEMO, DEMO_GROUP } from "@/lib/savora/demo";
import { decodeName, formatUsdc } from "@/lib/savora/format";
import { rpc } from "@/lib/savora/rpc";
import type { GroupAccount } from "@/lib/savora/queries";

export type CircleMeta = {
  name: string;
  contribution: string;
  seats: string;
  /** "Forming · 2 left" | "Round 3 of 8" | "Completed" */
  state: string;
  memberCount: number;
  capacity: number;
};

function toMeta(g: GroupAccount): CircleMeta {
  const d = g.data;
  const name = decodeName(d.name) || "A savings circle";
  const state =
    d.status === 0
      ? d.capacity - d.memberCount > 0
        ? `Forming · ${d.capacity - d.memberCount} left`
        : "Forming"
      : d.status === 2
        ? "Completed"
        : `Round ${d.currentCycle + 1} of ${d.memberCount}`;
  return {
    name,
    contribution: formatUsdc(d.contribution),
    seats: `${d.memberCount}/${d.capacity}`,
    state,
    memberCount: d.memberCount,
    capacity: d.capacity,
  };
}

/**
 * The circle behind a `/g/<address>` link, for its metadata + OG image. One
 * RPC read, ~2.5s ceiling; returns null on a missing circle or a slow RPC so
 * callers fall back to the brand card.
 */
export const getCircleMeta = cache(
  async (address: string): Promise<CircleMeta | null> => {
    if (DEMO) return toMeta(DEMO_GROUP);
    try {
      const account = await Promise.race([
        fetchMaybeGroup(rpc, address as Address),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("rpc timeout")), 2500),
        ),
      ]);
      if (!account.exists) return null;
      return toMeta({ address: address as Address, data: account.data });
    } catch {
      return null;
    }
  },
);

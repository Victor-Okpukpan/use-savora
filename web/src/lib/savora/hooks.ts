"use client";

import { useEffect, useMemo, useState } from "react";

import { useQueries, useQuery } from "@tanstack/react-query";

import type { Address } from "@solana/kit";

import {
  getCycle,
  getCycleHistory,
  getGroup,
  getGroupsForMember,
  type CycleAccount,
  type GroupAccount,
} from "./queries";
import { deriveActivity, type ActivityEvent } from "./activity";
import { decodeName } from "./format";
import { DEMO, DEMO_CYCLE, DEMO_GROUP, DEMO_HISTORY } from "./demo";

/** An activity event tagged with the circle it belongs to. */
export type TaggedEvent = ActivityEvent & {
  circle: string;
  groupAddress: string;
  members: string[];
};

export function useGroup(address: Address | null) {
  return useQuery({
    queryKey: ["group", address, DEMO],
    enabled: !!address,
    queryFn: () => (DEMO ? DEMO_GROUP : getGroup(address as Address)),
    refetchInterval: DEMO ? false : 15_000,
  });
}

export function useCurrentCycle(group: GroupAccount | null | undefined) {
  const address = group?.address ?? null;
  const index = group?.data.currentCycle ?? null;
  return useQuery({
    queryKey: ["cycle", address, index],
    enabled: !!group && group.data.status === 1 && index! < group.data.memberCount,
    queryFn: () => (DEMO ? DEMO_CYCLE : getCycle(address as Address, index as number)),
    refetchInterval: DEMO ? false : 15_000,
  });
}

export function useCycleHistory(group: GroupAccount | null | undefined) {
  return useQuery({
    queryKey: ["cycle-history", group?.address, group?.data.currentCycle],
    enabled: !!group,
    queryFn: () => (DEMO ? DEMO_HISTORY : getCycleHistory(group as GroupAccount)),
  });
}

/**
 * The current `Cycle` for every active group, as one parallel batch. Keyed the
 * same way as `useCurrentCycle` so the dashboard and the group page share
 * cache. Returns a map keyed by group address.
 */
export function useCurrentCycles(groups: GroupAccount[] | undefined) {
  const active = useMemo(
    () => (groups ?? []).filter((g) => g.data.status === 1),
    [groups],
  );

  const results = useQueries({
    queries: active.map((g) => {
      const index = g.data.currentCycle;
      return {
        queryKey: ["cycle", g.address, index],
        enabled: index < g.data.memberCount,
        queryFn: () =>
          DEMO ? DEMO_CYCLE : getCycle(g.address, index),
        refetchInterval: DEMO ? (false as const) : 15_000,
      };
    }),
  });

  return useMemo(() => {
    const map = new Map<string, CycleAccount | null>();
    active.forEach((g, i) => map.set(g.address, results[i]?.data ?? null));
    return {
      byGroup: map,
      isLoading: results.some((r) => r.isLoading),
    };
  }, [active, results]);
}

/**
 * Every activity event across every circle, newest-first, each tagged with its
 * circle. One `getCycleHistory` per group, batched.
 */
export function useAllActivity(groups: GroupAccount[] | undefined) {
  const list = useMemo(() => groups ?? [], [groups]);

  const results = useQueries({
    queries: list.map((g) => ({
      queryKey: ["cycle-history", g.address, g.data.currentCycle],
      queryFn: () => (DEMO ? DEMO_HISTORY : getCycleHistory(g)),
      refetchInterval: DEMO ? (false as const) : 20_000,
    })),
  });

  return useMemo(() => {
    const events: TaggedEvent[] = [];
    list.forEach((g, i) => {
      const cycles = results[i]?.data ?? [];
      const circle = decodeName(g.data.name) || "Untitled circle";
      const members = g.data.members.slice(0, g.data.memberCount);
      for (const e of deriveActivity(g, cycles)) {
        events.push({
          ...e,
          key: `${g.address}-${e.key}`,
          circle,
          groupAddress: g.address,
          members,
        });
      }
    });
    // deriveActivity already returns newest-first per circle; interleave by
    // round then kind so the merged feed reads roughly chronologically.
    const rank: Record<ActivityEvent["kind"], number> = {
      completed: 0,
      paid: 1,
      closed: 2,
      open: 3,
      missed: 4,
      sealed: 5,
      formed: 6,
    };
    events.sort((a, b) => {
      const ra = a.round ?? -1;
      const rb = b.round ?? -1;
      if (ra !== rb) return rb - ra;
      return rank[a.kind] - rank[b.kind];
    });
    return { events, isLoading: results.some((r) => r.isLoading) };
  }, [list, results]);
}

export function useMyGroups(member: Address | null) {
  return useQuery({
    queryKey: ["my-groups", member],
    enabled: !!member,
    queryFn: () =>
      DEMO ? [DEMO_GROUP] : getGroupsForMember(member as Address),
    refetchInterval: DEMO ? false : 20_000,
  });
}

/** Unix seconds, refreshed on an interval so deadline state stays current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type { CycleAccount, GroupAccount };

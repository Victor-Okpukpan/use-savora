"use client";

import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import type { Address } from "@solana/kit";

import {
  getCycle,
  getCycleHistory,
  getGroup,
  getGroupsForMember,
  type CycleAccount,
  type GroupAccount,
} from "./queries";
import { DEMO, DEMO_CYCLE, DEMO_GROUP, DEMO_HISTORY } from "./demo";

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

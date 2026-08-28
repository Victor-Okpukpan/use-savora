import type { Address } from "@solana/kit";

import type { Cycle, Group } from "@/generated";
import type { CycleAccount, GroupAccount } from "./queries";

/**
 * Static fixtures for `NEXT_PUBLIC_SAVORA_DEMO=1`. Lets the full UI and motion
 * be seen without a Privy app id or a live program. Never used when demo mode
 * is off.
 */
export const DEMO = process.env.NEXT_PUBLIC_SAVORA_DEMO === "1";

export const DEMO_ME =
  "7xKqB2sVjM4nQpR8wZ1yCfHgD3eLkT9uUvA6mN5oP2rt" as Address;

const M = (s: string) => s as Address;
const name = (t: string) => {
  const b = new Uint8Array(32);
  b.set(new TextEncoder().encode(t));
  return b;
};

const members: Address[] = [
  DEMO_ME,
  M("9wRtY6uI3oP1aS2dF4gH5jK7lZ8xC0vB1nM3qW4eR5t"),
  M("2mN4bV6cX8zL1kJ3hG5fD7sA9qW0eR2tY4uI6oP8aS1d"),
  M("Hn7Kq2Wm4Rt9Yx1Zb3Vc5Nd6Pf8Gh1Jk2Ll4Mm6Nn8P"),
  M("5tXcVJyUBc7Yx2Zb9Vc1Nd3Pf5Gh7Jk9Ll1Mm3Nn5Qp"),
];

/**
 * Names shown in the demo. These are attached to *fixture* wallets, not real
 * strangers — the live app only ever shows a nickname the viewer set.
 */
export const DEMO_LABELS: (string | undefined)[] = [
  "Tòlú",
  "Adéwalé",
  "Chidinma",
  "Ngozi",
  "Emeka",
];

export const DEMO_GROUP_ADDRESS =
  "Sav0raC1rc1eDemo111111111111111111111111111" as Address;

const groupData: Group = {
  discriminator: new Uint8Array(8),
  bump: 254,
  vaultBump: 0,
  creator: members[0],
  seed: 42n,
  mint: M("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  name: name("Ìyá's Circle"),
  contribution: 50_000_000n,
  cycleSecs: 604_800n,
  capacity: 5,
  memberCount: 5,
  members: [...members, ...Array(7).fill(M("11111111111111111111111111111111"))],
  rotation: new Uint8Array([2, 0, 4, 1, 3, 0, 0, 0, 0, 0, 0, 0]),
  missed: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  status: 1,
  currentCycle: 1,
  // Fixed epochs so the demo renders identically on server and client.
  cycleStart: 1_924_000_000n,
};

export const DEMO_GROUP: GroupAccount = {
  address: DEMO_GROUP_ADDRESS,
  data: groupData,
};

const cycleData: Cycle = {
  discriminator: new Uint8Array(8),
  bump: 255,
  group: DEMO_GROUP_ADDRESS,
  index: 1,
  recipientIndex: 0,
  deadline: 1_924_600_000n,
  pooled: 150_000_000n,
  contributed: 0b00111,
  contributorCount: 3,
  disbursed: false,
  payout: 0n,
};

export const DEMO_CYCLE: CycleAccount = {
  address: M("Sav0raCyc1eDemo11111111111111111111111111111"),
  data: cycleData,
};

export const DEMO_HISTORY: CycleAccount[] = [
  {
    address: M("Sav0raCyc1e0Demo1111111111111111111111111111"),
    data: {
      ...cycleData,
      index: 0,
      recipientIndex: 2,
      pooled: 250_000_000n,
      payout: 250_000_000n,
      contributed: 0b11111,
      contributorCount: 5,
      disbursed: true,
    },
  },
];

"use client";

import { useCallback, useMemo } from "react";

import { usePrivy } from "@privy-io/react-auth";
import {
  useSignAndSendTransaction,
  useWallets,
} from "@privy-io/react-auth/solana";
import {
  createNoopSigner,
  type Address,
  type Instruction,
} from "@solana/kit";

import {
  contributeIx,
  createGroupIx,
  disbursePayoutIx,
  joinGroupIx,
  leaveGroupIx,
  openCycleIx,
} from "./instructions";
import { confirmSignature, sendInstructions, type SignAndSend } from "./tx";
import { DEMO, DEMO_ME } from "./demo";

export type ConnectionState = {
  ready: boolean;
  authenticated: boolean;
  /** Base58 address of the active Solana wallet, if any. */
  address: Address | null;
  wallet: unknown | null;
};

const DEMO_CONNECTION: ConnectionState = {
  ready: true,
  authenticated: true,
  address: DEMO_ME,
  wallet: {},
};

export function useConnection(): ConnectionState {
  // Hooks run unconditionally; demo mode swaps the *result*, not the calls.
  // (Demo mode still mounts PrivyProvider — it just needs a valid app id.)
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  if (DEMO) return DEMO_CONNECTION;
  const wallet = wallets[0] ?? null;
  return {
    ready,
    authenticated,
    address: (wallet?.address as Address | undefined) ?? null,
    wallet,
  };
}

export function useSavora() {
  const { address, wallet } = useConnection();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const run = useCallback(
    async (build: (signer: ReturnType<typeof createNoopSigner>) => Promise<Instruction[]>) => {
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 900));
        return "demo-signature";
      }
      if (!address || !wallet) throw new Error("Connect a wallet first");
      const signer = createNoopSigner(address);
      const instructions = await build(signer);
      const { signature } = await sendInstructions(
        address,
        instructions,
        wallet,
        signAndSendTransaction as unknown as SignAndSend,
      );
      await confirmSignature(signature);
      return signature;
    },
    [address, wallet, signAndSendTransaction],
  );

  return useMemo(
    () => ({
      address,
      createGroup: (p: {
        seed: bigint;
        name: string;
        contribution: bigint;
        cycleSecs: bigint;
        capacity: number;
      }) => run(async (s) => [await createGroupIx({ creator: s, ...p })]),

      joinGroup: (group: Address) =>
        run(async (s) => [await joinGroupIx(s, group)]),

      leaveGroup: (group: Address) =>
        run(async (s) => [await leaveGroupIx(s, group)]),

      /** Contribute; opens the cycle account first if it does not exist yet. */
      contribute: (group: Address, cycleIndex: number, needsOpen: boolean) =>
        run(async (s) => [
          ...(needsOpen ? [await openCycleIx(s, group, cycleIndex)] : []),
          await contributeIx(s, group, cycleIndex),
        ]),

      openCycle: (group: Address, cycleIndex: number) =>
        run(async (s) => [await openCycleIx(s, group, cycleIndex)]),

      disburse: (group: Address, cycleIndex: number, recipient: Address) =>
        run(async (s) => [
          await disbursePayoutIx(s, group, cycleIndex, recipient),
        ]),
    }),
    [address, run],
  );
}

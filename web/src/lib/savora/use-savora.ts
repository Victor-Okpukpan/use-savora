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
  cancelExtensionIx,
  closeGroupIx,
  closePositionIx,
  contributeIx,
  createGroupIx,
  disbursePayoutIx,
  joinGroupIx,
  leaveGroupIx,
  openCycleIx,
  optInExtensionIx,
  proposeExtensionIx,
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
    async (
      build: (signer: ReturnType<typeof createNoopSigner>) => Promise<Instruction[]>,
    ) => {
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
        deposit: bigint;
        cycleSecs: bigint;
        graceSecs: bigint;
        capacity: number;
        rotations: number;
      }) => run(async (s) => [await createGroupIx({ creator: s, ...p })]),

      /**
       * Join a circle. Pass `opensRotation` when this join fills the last seat
       * — it bundles `open_cycle` so round 1 shuffles and opens in the same
       * transaction, instead of leaving the circle sealed-but-not-started.
       */
      joinGroup: (group: Address, opensRotation = false) =>
        run(async (s) => [
          await joinGroupIx(s, group),
          ...(opensRotation ? [await openCycleIx(s, group, 0)] : []),
        ]),

      leaveGroup: (group: Address) =>
        run(async (s) => [await leaveGroupIx(s, group)]),

      /** Contribute; opens the cycle account first if it does not exist yet. */
      contribute: (
        group: Address,
        cycleIndex: number,
        recipient: Address,
        needsOpen: boolean,
      ) =>
        run(async (s) => [
          ...(needsOpen ? [await openCycleIx(s, group, cycleIndex)] : []),
          await contributeIx(s, group, cycleIndex, recipient),
        ]),

      openCycle: (group: Address, cycleIndex: number) =>
        run(async (s) => [await openCycleIx(s, group, cycleIndex)]),

      disburse: (group: Address, cycleIndex: number, recipient: Address) =>
        run(async (s) => [
          await disbursePayoutIx(s, group, cycleIndex, recipient),
        ]),

      proposeExtension: (
        group: Address,
        additionalRotations: number,
        optinSecs: bigint,
      ) =>
        run(async (s) => [
          await proposeExtensionIx(s, group, additionalRotations, optinSecs),
        ]),

      optInExtension: (group: Address) =>
        run(async (s) => [await optInExtensionIx(s, group)]),

      cancelExtension: (group: Address) =>
        run(async (s) => [await cancelExtensionIx(s, group)]),

      closePosition: (group: Address) =>
        run(async (s) => [await closePositionIx(s, group)]),

      closeGroup: (group: Address) =>
        run(async (s) => [await closeGroupIx(s, group)]),
    }),
    [address, run],
  );
}

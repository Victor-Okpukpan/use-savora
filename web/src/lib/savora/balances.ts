"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "@solana/kit";
import { fetchMaybeToken } from "@solana-program/token";

import { USDC_MINT } from "./config";
import { DEMO } from "./demo";
import { findAta } from "./pdas";
import { rpc } from "./rpc";

export type Balances = {
  /** SOL in lamports. */
  sol: bigint;
  /** USDC in base units (6 dp). Null if the wallet has no USDC account yet. */
  usdc: bigint | null;
};

const DEMO_BALANCES: Balances = { sol: 942_100_000n, usdc: 120_000_000n };

export function useBalances(address: Address | null) {
  return useQuery({
    queryKey: ["balances", address, DEMO],
    enabled: !!address,
    refetchInterval: DEMO ? false : 20_000,
    queryFn: async (): Promise<Balances> => {
      if (DEMO) return DEMO_BALANCES;
      const owner = address as Address;
      const [ata] = await findAta(owner, USDC_MINT);
      const [sol, token] = await Promise.all([
        rpc.getBalance(owner).send(),
        fetchMaybeToken(rpc, ata),
      ]);
      return {
        sol: sol.value,
        usdc: token.exists ? token.data.amount : null,
      };
    },
  });
}

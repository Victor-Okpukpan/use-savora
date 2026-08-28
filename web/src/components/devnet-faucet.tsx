"use client";

import { useState } from "react";

import type { Address } from "@solana/kit";

import { rpc } from "@/lib/savora/rpc";

/**
 * Devnet only. A new embedded-wallet user starts with zero SOL and can't pay
 * transaction fees; USDC comes from Circle's faucet. Both are surfaced on the
 * profile so the group pages don't carry a funding strip.
 */
export function DevnetFunds({ address }: { address: Address }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );

  async function airdrop() {
    setState("working");
    try {
      await rpc.requestAirdrop(address, 1_000_000_000n as never).send();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <button
        onClick={airdrop}
        disabled={state === "working"}
        className="rounded-control border border-line bg-surface px-3 py-1.5 text-ink transition-colors hover:bg-surface-sunk disabled:opacity-40"
      >
        {state === "working"
          ? "Requesting…"
          : state === "done"
            ? "1 SOL requested"
            : state === "error"
              ? "Faucet busy — retry"
              : "Airdrop 1 SOL"}
      </button>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noreferrer"
        className="text-accent underline-offset-2 hover:underline"
      >
        Get devnet USDC ↗
      </a>
    </div>
  );
}

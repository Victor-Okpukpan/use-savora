"use client";

import { useState } from "react";

import type { Address } from "@solana/kit";

import { rpc } from "@/lib/savora/rpc";

/**
 * Devnet only. An embedded-wallet user starts with zero SOL and can't pay
 * transaction fees; USDC has to come from Circle's faucet. Both are surfaced
 * here rather than left as a dead end.
 */
export function DevnetFaucet({ address }: { address: Address }) {
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
    <div className="rounded-card border border-dashed border-line px-4 py-3 text-[12px] text-ink-muted">
      <p className="font-medium text-ink">Need funds on devnet?</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          onClick={airdrop}
          disabled={state === "working"}
          className="text-accent underline-offset-2 hover:underline disabled:opacity-40"
        >
          {state === "working"
            ? "Requesting…"
            : state === "done"
              ? "1 SOL requested"
              : state === "error"
                ? "Faucet busy — try again"
                : "Airdrop 1 SOL for fees"}
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
    </div>
  );
}

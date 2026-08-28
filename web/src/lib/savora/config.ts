import type { Address } from "@solana/kit";

import { SAVORA_PROGRAM_ADDRESS } from "@/generated";

/** Deployed Savora program. Matches `declare_id!` in `programs/savora`. */
export const PROGRAM_ID = SAVORA_PROGRAM_ADDRESS;

/**
 * Circle USDC on devnet (6 decimals). Fund a wallet from
 * https://faucet.circle.com (select "Solana Devnet").
 */
export const USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" as Address;

export const USDC_DECIMALS = 6;

/** Mirrors `MAX_MEMBERS` in the program. */
export const MAX_MEMBERS = 12;

/** Mirrors `NAME_LEN` in the program. */
export const NAME_LEN = 32;

/** Mirrors `MIN_CYCLE_SECS` in the program. */
export const MIN_CYCLE_SECS = 60;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const RPC_SUBSCRIPTIONS_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_SUBSCRIPTIONS_URL ??
  "wss://api.devnet.solana.com";

/** Privy's Solana chain literal for signing + `solana.rpcs` config. */
export const SOLANA_CHAIN = "solana:devnet" as const;

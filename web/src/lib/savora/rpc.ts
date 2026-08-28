import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

import { RPC_SCAN_URL, RPC_SUBSCRIPTIONS_URL, RPC_URL } from "./config";

export const rpc = createSolanaRpc(RPC_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_SUBSCRIPTIONS_URL);

/**
 * Separate client for `getProgramAccounts` scans — some providers (Alchemy's
 * free tier) don't serve that method. Falls back to the public devnet RPC.
 */
export const rpcScan =
  RPC_SCAN_URL === RPC_URL ? rpc : createSolanaRpc(RPC_SCAN_URL);

export type Rpc = typeof rpc;

import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

import { RPC_SUBSCRIPTIONS_URL, RPC_URL } from "./config";

export const rpc = createSolanaRpc(RPC_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_SUBSCRIPTIONS_URL);

export type Rpc = typeof rpc;

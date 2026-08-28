import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase58Decoder,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";

import { SOLANA_CHAIN } from "./config";
import { rpc } from "./rpc";

/**
 * Minimal shape of Privy's `signAndSendTransaction` we depend on.
 *
 * `options.optimisticBroadcast` sets Privy's internal `skipConfirmation`, so it
 * returns the signature the moment the broadcast lands instead of running its
 * own hardcoded 10s websocket confirmation — which races a *different* RPC node
 * than the one that broadcast and, when it loses, throws a bare "Transaction
 * confirmation timed out" with no signature attached. We confirm ourselves in
 * `confirmSignature` (30s of `getSignatureStatuses` polling over the app RPC).
 */
export type SignAndSend = (input: {
  transaction: Uint8Array;
  wallet: unknown;
  chain?: typeof SOLANA_CHAIN;
  options?: { optimisticBroadcast?: boolean; skipSimulation?: boolean };
}) => Promise<{ signature: Uint8Array }>;

export type SendResult = { signature: string };

/**
 * The one place a Savora transaction is built and sent. Instructions come from
 * the generated client; signing and submission are Privy's. The connected
 * wallet is the fee payer, added as a no-op signer so the message compiles
 * before Privy attaches the real signature.
 */
export async function sendInstructions(
  feePayer: Address,
  instructions: Instruction[],
  wallet: unknown,
  signAndSend: SignAndSend,
  opts?: { priorityFeeMicroLamports?: bigint; computeUnitLimit?: number },
): Promise<SendResult> {
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();

  const priorityFee = opts?.priorityFeeMicroLamports ?? 50_000n;
  // Savora's heaviest instruction (`contribute` with the inline auto-disburse)
  // fits well under 200k CU; 220k leaves headroom without over-reserving.
  const computeUnitLimit = opts?.computeUnitLimit ?? 220_000;
  const withBudget: Instruction[] = [
    getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
    getSetComputeUnitPriceInstruction({ microLamports: priorityFee }),
    ...instructions,
  ];

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(createNoopSigner(feePayer), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(withBudget, m),
  );

  const wire = getTransactionEncoder().encode(compileTransaction(message));

  const { signature } = await signAndSend({
    transaction: new Uint8Array(wire),
    wallet,
    chain: SOLANA_CHAIN,
    options: { optimisticBroadcast: true },
  });

  return { signature: getBase58Decoder().decode(signature) };
}

/** Wait for a signature to confirm, polling the RPC. */
export async function confirmSignature(
  signature: string,
  timeoutMs = 30_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { value } = await rpc
      .getSignatureStatuses([signature as never])
      .send();
    const status = value[0];
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      if (status.err) throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Timed out waiting for confirmation");
}

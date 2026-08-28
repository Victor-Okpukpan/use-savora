import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64Encoder,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  getMintEncoder,
  getMintSize,
  getTokenEncoder,
  getTokenSize,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  FailedTransactionMetadata,
  LiteSVM,
  TransactionMetadata,
} from "litesvm";

import { PROGRAM_ID } from "@/lib/savora/config";
import { findAta } from "@/lib/savora/pdas";

const here = dirname(fileURLToPath(import.meta.url));
const SO_PATH = join(here, "..", "target", "deploy", "savora.so");

const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;
const b64 = getBase64Encoder();

export const USDC_DECIMALS = 6;
export const USDC = (whole: number | bigint, fraction = 0n): bigint =>
  BigInt(whole) * 1_000_000n + BigInt(fraction);

export type Harness = {
  svm: LiteSVM;
  mint: Address;
  /** Create a funded signer with `sol` SOL for fees. */
  wallet: (sol?: number) => Promise<KeyPairSigner>;
  /** Fabricate an initialized token account for `owner` holding `amount`. */
  fundToken: (owner: Address, amount: bigint) => Promise<Address>;
  send: (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ) => Promise<TransactionMetadata | FailedTransactionMetadata>;
  expectOk: (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ) => Promise<TransactionMetadata>;
  expectErr: (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ) => Promise<FailedTransactionMetadata>;
  clockForward: (seconds: number | bigint) => void;
};

export async function setupHarness(): Promise<Harness> {
  const svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ID, SO_PATH);

  const mintSigner = await generateKeyPairSigner();
  const mint = mintSigner.address;
  const mintData = getMintEncoder().encode({
    mintAuthority: mint, // arbitrary; tests fabricate balances directly
    supply: 0n,
    decimals: USDC_DECIMALS,
    isInitialized: true,
    freezeAuthority: null,
  });
  svm.setAccount({
    address: mint,
    data: new Uint8Array(mintData),
    executable: false,
    lamports: lamports(svm.minimumBalanceForRentExemption(BigInt(getMintSize()))),
    programAddress: TOKEN_PROGRAM_ADDRESS,
    space: BigInt(getMintSize()),
  });

  const wallet = async (sol = 100): Promise<KeyPairSigner> => {
    const signer = await generateKeyPairSigner();
    svm.airdrop(signer.address, lamports(BigInt(sol) * 1_000_000_000n));
    return signer;
  };

  const fundToken = async (owner: Address, amount: bigint): Promise<Address> => {
    const [ata] = await findAta(owner, mint);
    const data = getTokenEncoder().encode({
      mint,
      owner,
      amount,
      delegate: null,
      state: 1, // AccountState.Initialized
      isNative: null,
      delegatedAmount: 0n,
      closeAuthority: null,
    });
    svm.setAccount({
      address: ata,
      data: new Uint8Array(data),
      executable: false,
      lamports: lamports(
        svm.minimumBalanceForRentExemption(BigInt(getTokenSize())),
      ),
      programAddress: TOKEN_PROGRAM_ADDRESS,
      space: BigInt(getTokenSize()),
    });
    return ata;
  };

  const send = async (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ): Promise<TransactionMetadata | FailedTransactionMetadata> => {
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(feePayer, m),
      (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    );
    const signed = await signTransactionMessageWithSigners(message);
    return svm.sendTransaction(signed);
  };

  const expectOk = async (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ): Promise<TransactionMetadata> => {
    const res = await send(feePayer, ixs);
    if (res instanceof FailedTransactionMetadata) {
      throw new Error(
        `expected success, got failure: ${res.err()}\n${res.meta().logs().join("\n")}`,
      );
    }
    return res;
  };

  const expectErr = async (
    feePayer: KeyPairSigner,
    ixs: Instruction[],
  ): Promise<FailedTransactionMetadata> => {
    const res = await send(feePayer, ixs);
    if (!(res instanceof FailedTransactionMetadata)) {
      throw new Error("expected failure, got success");
    }
    return res;
  };

  const clockForward = (seconds: number | bigint): void => {
    const clock = svm.getClock();
    clock.unixTimestamp = clock.unixTimestamp + BigInt(seconds);
    svm.setClock(clock);
  };

  return {
    svm,
    mint,
    wallet,
    fundToken,
    send,
    expectOk,
    expectErr,
    clockForward,
  };
}

export function decodeAccount<T>(
  svm: LiteSVM,
  address: Address,
  decoder: { decode: (bytes: Uint8Array) => T },
): T {
  const acc = svm.getAccount(address);
  if (!acc) throw new Error(`account ${address} not found`);
  return decoder.decode(new Uint8Array(acc.data));
}

export async function tokenBalanceAt(
  svm: LiteSVM,
  owner: Address,
  mint: Address,
): Promise<bigint> {
  const [ata] = await findAta(owner, mint);
  const acc = svm.getAccount(ata);
  if (!acc) return 0n;
  const { getTokenDecoder } = await import("@solana-program/token");
  return getTokenDecoder().decode(new Uint8Array(acc.data)).amount;
}

export { FailedTransactionMetadata, TransactionMetadata, b64, SYSTEM_PROGRAM };

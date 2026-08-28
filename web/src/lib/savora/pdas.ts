import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  type Address,
  type ProgramDerivedAddress,
} from "@solana/kit";

import { PROGRAM_ID } from "./config";

const ASSOCIATED_TOKEN_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;
const TOKEN_PROGRAM_ID =
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;

const enc = new TextEncoder();

export async function findGroupPda(
  creator: Address,
  seed: bigint,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      enc.encode("group"),
      getAddressEncoder().encode(creator),
      getU64Encoder().encode(seed),
    ],
  });
}

/**
 * `Cycle` PDA. Its seed uses the cycle index directly (not `group.current_cycle`),
 * so the client must pass the index it wants — the current one to act on it, or
 * a past one to read history.
 */
export async function findCyclePda(
  group: Address,
  index: number,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      enc.encode("cycle"),
      getAddressEncoder().encode(group),
      new Uint8Array([index]),
    ],
  });
}

export async function findAta(
  owner: Address,
  mint: Address,
): Promise<ProgramDerivedAddress> {
  return getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
    seeds: [
      getAddressEncoder().encode(owner),
      getAddressEncoder().encode(TOKEN_PROGRAM_ID),
      getAddressEncoder().encode(mint),
    ],
  });
}

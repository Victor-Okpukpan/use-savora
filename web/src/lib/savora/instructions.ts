import type { Address, Instruction, TransactionSigner } from "@solana/kit";

import {
  getCancelExtensionInstruction,
  getCloseGroupInstructionAsync,
  getClosePositionInstructionAsync,
  getContributeInstructionAsync,
  getCreateGroupInstructionAsync,
  getDisbursePayoutInstructionAsync,
  getJoinGroupInstructionAsync,
  getLeaveGroupInstructionAsync,
  getOpenCycleInstruction,
  getOptInExtensionInstruction,
  getProposeExtensionInstruction,
} from "@/generated";

import { USDC_MINT } from "./config";
import { encodeName } from "./format";
import { findAta, findCyclePda, findGroupPda } from "./pdas";

export type CreateGroupParams = {
  creator: TransactionSigner;
  seed: bigint;
  name: string;
  /** Per-member, per-cycle amount in base units. */
  contribution: bigint;
  /** Locked at join, refunded on a clean exit. Must be >= contribution. */
  deposit: bigint;
  cycleSecs: bigint;
  graceSecs: bigint;
  capacity: number;
  /** Full rotations to run before the circle completes. */
  rotations: number;
  mint?: Address;
};

export async function createGroupIx(p: CreateGroupParams): Promise<Instruction> {
  const mint = p.mint ?? USDC_MINT;
  const [group] = await findGroupPda(p.creator.address, p.seed);
  return getCreateGroupInstructionAsync({
    creator: p.creator,
    group,
    mint,
    seed: p.seed,
    name: encodeName(p.name),
    contribution: p.contribution,
    deposit: p.deposit,
    cycleSecs: p.cycleSecs,
    graceSecs: p.graceSecs,
    capacity: p.capacity,
    rotations: p.rotations,
  });
}

export async function joinGroupIx(
  member: TransactionSigner,
  group: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  return getJoinGroupInstructionAsync({ member, group, mint });
}

export async function leaveGroupIx(
  member: TransactionSigner,
  group: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  return getLeaveGroupInstructionAsync({ member, group, mint });
}

export async function openCycleIx(
  payer: TransactionSigner,
  group: Address,
  cycleIndex: number,
): Promise<Instruction> {
  const [cycle] = await findCyclePda(group, cycleIndex);
  return getOpenCycleInstruction({ payer, group, cycle });
}

export async function contributeIx(
  member: TransactionSigner,
  group: Address,
  cycleIndex: number,
  recipient: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  const [cycle] = await findCyclePda(group, cycleIndex);
  const [recipientToken] = await findAta(recipient, mint);
  return getContributeInstructionAsync({
    member,
    group,
    cycle,
    mint,
    recipient,
    recipientToken,
  });
}

export async function disbursePayoutIx(
  cranker: TransactionSigner,
  group: Address,
  cycleIndex: number,
  recipient: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  const [cycle] = await findCyclePda(group, cycleIndex);
  return getDisbursePayoutInstructionAsync({
    cranker,
    group,
    cycle,
    recipient,
    mint,
  });
}

export async function proposeExtensionIx(
  creator: TransactionSigner,
  group: Address,
  additionalRotations: number,
  optinSecs: bigint,
): Promise<Instruction> {
  return getProposeExtensionInstruction({
    creator,
    group,
    additionalRotations,
    optinSecs,
  });
}

export async function optInExtensionIx(
  member: TransactionSigner,
  group: Address,
): Promise<Instruction> {
  return getOptInExtensionInstruction({ member, group });
}

export async function cancelExtensionIx(
  signer: TransactionSigner,
  group: Address,
): Promise<Instruction> {
  return getCancelExtensionInstruction({ signer, group });
}

export async function closePositionIx(
  member: TransactionSigner,
  group: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  return getClosePositionInstructionAsync({ member, group, mint });
}

export async function closeGroupIx(
  creator: TransactionSigner,
  group: Address,
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  return getCloseGroupInstructionAsync({ creator, group, mint });
}

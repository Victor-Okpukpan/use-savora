import type { Address, Instruction, TransactionSigner } from "@solana/kit";

import {
  getContributeInstructionAsync,
  getCreateGroupInstructionAsync,
  getDisbursePayoutInstructionAsync,
  getJoinGroupInstruction,
  getLeaveGroupInstruction,
  getOpenCycleInstruction,
} from "@/generated";

import { USDC_MINT } from "./config";
import { encodeName } from "./format";
import { findCyclePda, findGroupPda } from "./pdas";

const SLOT_HASHES_SYSVAR =
  "SysvarS1otHashes111111111111111111111111111" as Address;

export type CreateGroupParams = {
  creator: TransactionSigner;
  seed: bigint;
  name: string;
  /** Per-member, per-cycle amount in USDC base units. */
  contribution: bigint;
  cycleSecs: bigint;
  capacity: number;
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
    cycleSecs: p.cycleSecs,
    capacity: p.capacity,
  });
}

export async function joinGroupIx(
  member: TransactionSigner,
  group: Address,
): Promise<Instruction> {
  return getJoinGroupInstruction({
    member,
    group,
    slotHashes: SLOT_HASHES_SYSVAR,
  });
}

export async function leaveGroupIx(
  member: TransactionSigner,
  group: Address,
): Promise<Instruction> {
  return getLeaveGroupInstruction({ member, group });
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
  mint: Address = USDC_MINT,
): Promise<Instruction> {
  const [cycle] = await findCyclePda(group, cycleIndex);
  return getContributeInstructionAsync({ member, group, cycle, mint });
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

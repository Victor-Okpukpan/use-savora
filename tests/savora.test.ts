import { beforeEach, describe, expect, it } from "vitest";

import type { Address, KeyPairSigner } from "@solana/kit";

import {
  getCycleDecoder,
  getDisbursePayoutInstruction,
  getGroupDecoder,
} from "@/generated";
import {
  contributeIx,
  createGroupIx,
  disbursePayoutIx,
  joinGroupIx,
  leaveGroupIx,
  openCycleIx,
} from "@/lib/savora/instructions";
import { findAta, findCyclePda, findGroupPda } from "@/lib/savora/pdas";

import {
  decodeAccount,
  setupHarness,
  tokenBalanceAt,
  USDC,
  type Harness,
} from "./harness";

let h: Harness;
let seedCounter = 0n;

beforeEach(async () => {
  h = await setupHarness();
});

async function newGroup(opts: {
  contribution: bigint;
  capacity: number;
  cycleSecs?: bigint;
}) {
  const creator = await h.wallet();
  const seed = seedCounter++;
  const [group] = await findGroupPda(creator.address, seed);
  await h.expectOk(creator, [
    await createGroupIx({
      creator,
      seed,
      name: "Test Circle",
      contribution: opts.contribution,
      cycleSecs: opts.cycleSecs ?? 3600n,
      capacity: opts.capacity,
      mint: h.mint,
    }),
  ]);
  return { creator, group, seed };
}

function readGroup(group: Address) {
  return decodeAccount(h.svm, group, getGroupDecoder());
}

async function readCycle(group: Address, index: number) {
  const [cycle] = await findCyclePda(group, index);
  return decodeAccount(h.svm, cycle, getCycleDecoder());
}

/** Join with `count` fresh wallets, each pre-funded with `bal` tokens. */
async function fillSeats(group: Address, count: number, bal: bigint) {
  const members: KeyPairSigner[] = [];
  for (let i = 0; i < count; i++) {
    const m = await h.wallet();
    await h.fundToken(m.address, bal);
    await h.expectOk(m, [await joinGroupIx(m, group)]);
    members.push(m);
  }
  return members;
}

async function runCycle(
  group: Address,
  index: number,
  contributors: KeyPairSigner[],
  cranker: KeyPairSigner,
) {
  await h.expectOk(cranker, [await openCycleIx(cranker, group, index)]);
  for (const c of contributors) {
    await h.expectOk(c, [await contributeIx(c, group, index, h.mint)]);
  }
  const g = readGroup(group);
  const recipient = g.members[g.rotation[index]];
  const before = await tokenBalanceAt(h.svm, recipient, h.mint);
  await h.expectOk(cranker, [
    await disbursePayoutIx(cranker, group, index, recipient, h.mint),
  ]);
  const after = await tokenBalanceAt(h.svm, recipient, h.mint);
  return { recipient, delta: after - before };
}

describe("savora program", () => {
  it("runs a full 3-member rotation to completion and drains the vault", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({ contribution, capacity: 3 });

    // creator is member 0; two more fill the roster and seal it.
    await h.fundToken(creator.address, contribution * 3n);
    const others = await fillSeats(group, 2, contribution * 3n);
    const all = [creator, ...others];

    let g = readGroup(group);
    expect(g.status).toBe(1); // Active
    expect(g.memberCount).toBe(3);

    for (let cycle = 0; cycle < 3; cycle++) {
      const { delta } = await runCycle(group, cycle, all, creator);
      // snapshot is taken after everyone (recipient included) has paid in
      expect(delta).toBe(contribution * 3n);

      const c = await readCycle(group, cycle);
      expect(c.disbursed).toBe(true);
      expect(c.payout).toBe(contribution * 3n);
      expect(await tokenBalanceAt(h.svm, group, h.mint)).toBe(0n);
    }

    g = readGroup(group);
    expect(g.status).toBe(2); // Completed
    expect(g.currentCycle).toBe(3);
    expect(await tokenBalanceAt(h.svm, group, h.mint)).toBe(0n);
    // every member collected exactly once
    expect([...g.rotation.slice(0, 3)].sort()).toEqual([0, 1, 2]);
  });

  it("seals with a rotation that is a permutation of all member slots", async () => {
    const { group } = await newGroup({ contribution: USDC(5), capacity: 6 });
    await fillSeats(group, 5, USDC(50));
    const g = readGroup(group);
    expect(g.status).toBe(1);
    expect([...g.rotation.slice(0, 6)].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("lets a forming member leave, but not the creator", async () => {
    const { creator, group } = await newGroup({
      contribution: USDC(5),
      capacity: 4,
    });
    const m = await h.wallet();
    await h.expectOk(m, [await joinGroupIx(m, group)]);
    expect(readGroup(group).memberCount).toBe(2);

    await h.expectOk(m, [await leaveGroupIx(m, group)]);
    expect(readGroup(group).memberCount).toBe(1);

    await h.expectErr(creator, [await leaveGroupIx(creator, group)]);
  });

  it("rejects a second contribution from the same member in one cycle", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({ contribution, capacity: 2 });
    await h.fundToken(creator.address, contribution * 4n);
    await fillSeats(group, 1, contribution * 4n);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    await h.expectOk(creator, [await contributeIx(creator, group, 0, h.mint)]);
    await h.expectErr(creator, [await contributeIx(creator, group, 0, h.mint)]);
  });

  it("rejects a contribution from a non-member", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({ contribution, capacity: 2 });
    await fillSeats(group, 1, contribution * 2n);

    const outsider = await h.wallet();
    await h.fundToken(outsider.address, contribution * 2n);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    await h.expectErr(outsider, [
      await contributeIx(outsider, group, 0, h.mint),
    ]);
  });

  it("will not let the crank redirect the payout to another account", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({ contribution, capacity: 2 });
    await h.fundToken(creator.address, contribution * 2n);
    const [other] = await fillSeats(group, 1, contribution * 2n);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    await h.expectOk(creator, [await contributeIx(creator, group, 0, h.mint)]);
    await h.expectOk(other, [await contributeIx(other, group, 0, h.mint)]);

    // Attacker crafts the instruction by hand, substituting their own wallet
    // and ATA for the rotation-designated recipient.
    const attacker = await h.wallet();
    const [cyclePda] = await findCyclePda(group, 0);
    const [vault] = await findAta(group, h.mint);
    const [attackerAta] = await findAta(attacker.address, h.mint);
    await h.fundToken(attacker.address, 0n);

    const badIx = getDisbursePayoutInstruction({
      cranker: attacker,
      group,
      cycle: cyclePda,
      mint: h.mint,
      vault,
      recipient: attacker.address,
      recipientToken: attackerAta,
    });
    await h.expectErr(attacker, [badIx]);

    // The legitimate crank still works and pays the right member.
    const g = readGroup(group);
    const recipient = g.members[g.rotation[0]];
    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
    expect((await tokenBalanceAt(h.svm, recipient, h.mint)) - before).toBe(
      contribution * 2n,
    );
  });

  it("rejects a crank before the deadline when the pool is not full", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({
      contribution,
      capacity: 3,
      cycleSecs: 3600n,
    });
    await h.fundToken(creator.address, contribution * 3n);
    await fillSeats(group, 2, contribution * 3n);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    await h.expectOk(creator, [await contributeIx(creator, group, 0, h.mint)]);

    const g = readGroup(group);
    const recipient = g.members[g.rotation[0]];
    await h.expectErr(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
  });

  it("pays out short after the deadline and records the miss", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({
      contribution,
      capacity: 3,
      cycleSecs: 3600n,
    });
    await h.fundToken(creator.address, contribution * 3n);
    const others = await fillSeats(group, 2, contribution * 3n);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    // Only creator and one other contribute; the third is a no-show.
    await h.expectOk(creator, [await contributeIx(creator, group, 0, h.mint)]);
    await h.expectOk(others[0], [
      await contributeIx(others[0], group, 0, h.mint),
    ]);

    h.clockForward(3601);

    const g = readGroup(group);
    const recipientIndex = g.rotation[0];
    const recipient = g.members[recipientIndex];
    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
    expect((await tokenBalanceAt(h.svm, recipient, h.mint)) - before).toBe(
      contribution * 2n,
    );

    const after = readGroup(group);
    // members[2] is the no-show (creator=0, others[0]=1, others[1]=2)
    expect(after.missed[2]).toBe(1);
    expect(after.missed[0]).toBe(0);
    expect(after.currentCycle).toBe(1);
    const c0 = await readCycle(group, 0);
    expect(c0.payout).toBe(contribution * 2n);
  });

  it("advances a cycle that nobody funded", async () => {
    const contribution = USDC(10);
    const { creator, group } = await newGroup({
      contribution,
      capacity: 2,
      cycleSecs: 3600n,
    });
    await fillSeats(group, 1, contribution);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    h.clockForward(3601);

    const g = readGroup(group);
    const recipient = g.members[g.rotation[0]];
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);

    const c0 = await readCycle(group, 0);
    expect(c0.disbursed).toBe(true);
    expect(c0.payout).toBe(0n);
    expect(readGroup(group).currentCycle).toBe(1);
    expect(readGroup(group).missed[0]).toBe(1);
    expect(readGroup(group).missed[1]).toBe(1);
  });
});


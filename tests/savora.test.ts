import { beforeEach, describe, expect, it } from "vitest";

import type { Address, KeyPairSigner } from "@solana/kit";

import { getCycleDecoder, getGroupDecoder } from "@/generated";
import {
  cancelExtensionIx,
  closeGroupIx,
  closePositionIx,
  contributeIx,
  createGroupIx,
  disbursePayoutIx,
  joinGroupIx,
  leaveGroupIx,
  openCycleIx,
  optInExtensionIx,
  proposeExtensionIx,
} from "@/lib/savora/instructions";
import { findCyclePda, findGroupPda } from "@/lib/savora/pdas";

import {
  decodeAccount,
  setupHarness,
  tokenBalanceAt,
  USDC,
  type Harness,
} from "./harness";

let h: Harness;
let seedCounter = 0n;

const C = USDC(10); // default contribution
const HOUR = 3600n;

// GroupStatus discriminants
const FORMING = 0;
const ACTIVE = 1;
const COMPLETED = 2;
const EXTENDING = 3;
const FAILED = 4;

beforeEach(async () => {
  h = await setupHarness();
});

// --- fixtures -----------------------------------------------------------------

async function newGroup(opts: {
  contribution?: bigint;
  deposit?: bigint;
  capacity: number;
  cycleSecs?: bigint;
  graceSecs?: bigint;
  rotations?: number;
}) {
  const contribution = opts.contribution ?? C;
  const deposit = opts.deposit ?? contribution;
  const creator = await h.wallet();
  const seed = seedCounter++;
  const [group] = await findGroupPda(creator.address, seed);
  // deposit + plenty of headroom for contributions across rotations
  await h.fundToken(creator.address, deposit + contribution * 200n);
  await h.expectOk(creator, [
    await createGroupIx({
      creator,
      seed,
      name: "Test Circle",
      contribution,
      deposit,
      cycleSecs: opts.cycleSecs ?? HOUR,
      graceSecs: opts.graceSecs ?? 600n,
      capacity: opts.capacity,
      rotations: opts.rotations ?? 1,
      mint: h.mint,
    }),
  ]);
  return { creator, group, seed, contribution, deposit };
}

/** Join `count` fresh wallets, each pre-funded with `bal`. */
async function fillSeats(group: Address, count: number, bal: bigint) {
  const members: KeyPairSigner[] = [];
  for (let i = 0; i < count; i++) {
    const m = await h.wallet();
    await h.fundToken(m.address, bal);
    await h.expectOk(m, [await joinGroupIx(m, group, h.mint)]);
    members.push(m);
  }
  return members;
}

function readGroup(group: Address) {
  return decodeAccount(h.svm, group, getGroupDecoder());
}

async function readCycle(group: Address, index: number) {
  const [cycle] = await findCyclePda(group, index);
  return decodeAccount(h.svm, cycle, getCycleDecoder());
}

function liveSlots(g: ReturnType<typeof readGroup>): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.seatCount; i++) {
    if ((g.ejected & (1 << i)) === 0) out.push(i);
  }
  return out;
}

async function vaultBalance(group: Address) {
  return tokenBalanceAt(h.svm, group, h.mint);
}

/** V == deposit * active + pooled(open undisbursed cycle). Asserted everywhere. */
async function expectVaultInvariant(group: Address, deposit: bigint) {
  const g = readGroup(group);
  const active = BigInt(liveSlots(g).length);
  let pooled = 0n;
  try {
    const c = await readCycle(group, g.currentCycle);
    if (!c.disbursed) pooled = c.pooled;
  } catch {
    /* no open cycle */
  }
  expect(await vaultBalance(group)).toBe(active * deposit + pooled);
}

/**
 * Open + fund the current round from `bySlot`, everyone except the recipient.
 * The last contribution auto-disburses (every member ATA exists in tests).
 * Returns the recipient and the delta they received.
 */
async function playRound(
  group: Address,
  bySlot: Map<number, KeyPairSigner>,
  deposit: bigint,
) {
  const g0 = readGroup(group);
  const idx = g0.currentCycle;
  const opener = [...bySlot.values()][0];

  await h.expectOk(opener, [await openCycleIx(opener, group, idx)]);
  await expectVaultInvariant(group, deposit);

  // Read AFTER open — a rotation boundary reshuffles `rotation` here.
  const g = readGroup(group);
  const order = [...g.rotation.slice(0, g.rotationLen)].join(",");
  const recipientSlot = g.rotation[g.rotationPos];
  const recipient = g.members[recipientSlot];

  const payers = liveSlots(g).filter((s) => s !== recipientSlot);
  const before = await tokenBalanceAt(h.svm, recipient, h.mint);
  for (const slot of payers) {
    await h.expectOk(bySlot.get(slot)!, [
      await contributeIx(bySlot.get(slot)!, group, idx, recipient, h.mint),
    ]);
  }
  const after = await tokenBalanceAt(h.svm, recipient, h.mint);
  await expectVaultInvariant(group, deposit);

  const c = await readCycle(group, idx);
  expect(c.disbursed).toBe(true);
  return { recipient, recipientSlot, delta: after - before, cycle: c, order };
}

/** Map every current member to their slot index (creator is slot 0). */
function rosterBySlot(
  group: Address,
  creator: KeyPairSigner,
  joiners: KeyPairSigner[],
) {
  const g = readGroup(group);
  const bySlot = new Map<number, KeyPairSigner>();
  const all = [creator, ...joiners];
  for (const s of all) {
    const idx = g.members.findIndex((m) => m === s.address);
    if (idx >= 0) bySlot.set(idx, s);
  }
  return bySlot;
}

// --- tests -------------------------------------------------------------------

describe("savora program", () => {
  it("runs a full 3-member rotation to Completed and drains the round pool", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      rotations: 1,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 10n);
    const bySlot = rosterBySlot(group, creator, joiners);

    let g = readGroup(group);
    expect(g.status).toBe(ACTIVE);
    expect(g.seatCount).toBe(3);
    await expectVaultInvariant(group, deposit); // 3 deposits parked

    const collectors = new Set<number>();
    for (let r = 0; r < 3; r++) {
      const { delta, recipientSlot } = await playRound(group, bySlot, deposit);
      expect(delta).toBe(contribution * 2n); // pot = (live-1) * c
      collectors.add(recipientSlot);
    }
    expect(collectors.size).toBe(3); // everyone collected once

    g = readGroup(group);
    expect(g.status).toBe(COMPLETED);
    expect(g.currentCycle).toBe(3);
    expect(g.rotationsDone).toBe(1);

    // deposits still parked until members withdraw
    expect(await vaultBalance(group)).toBe(deposit * 3n);
    for (const m of [creator, ...joiners]) {
      await h.expectOk(m, [await closePositionIx(m, group, h.mint)]);
    }
    expect(await vaultBalance(group)).toBe(0n);
  });

  it("runs 3 rotations, reshuffling the order each pass", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      rotations: 3,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 20n);
    const bySlot = rosterBySlot(group, creator, joiners);

    const orders: string[] = [];
    for (let r = 0; r < 3; r++) {
      // the first round of each rotation opens at a boundary and reshuffles
      const { order } = await playRound(group, bySlot, deposit);
      orders.push(order);
      await playRound(group, bySlot, deposit);
      await playRound(group, bySlot, deposit);
    }

    const g = readGroup(group);
    expect(g.status).toBe(COMPLETED);
    expect(g.rotationsDone).toBe(3);
    expect(g.currentCycle).toBe(9);
    // the salt makes each pass permute differently even though LiteSVM's slot
    // hash never moves
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("auto-disburses on the final contribution — one transaction, no crank", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 2,
      rotations: 1,
    });
    const [other] = await fillSeats(group, 1, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, [other]);

    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);
    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    const payer = bySlot.get(liveSlots(g).find((s) => s !== recipientSlot)!)!;

    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(payer, [
      await contributeIx(payer, group, 0, recipient, h.mint),
    ]);
    const after = await tokenBalanceAt(h.svm, recipient, h.mint);

    expect(after - before).toBe(contribution); // 1 other member pays in
    const c = await readCycle(group, 0);
    expect(c.disbursed).toBe(true);
    expect(c.payout).toBe(contribution);
  });

  it("rejects a second contribution from the same member in one round", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    const payerSlot = liveSlots(g).find((s) => s !== recipientSlot)!;
    const payer = bySlot.get(payerSlot)!;

    await h.expectOk(payer, [
      await contributeIx(payer, group, 0, recipient, h.mint),
    ]);
    await h.expectErr(payer, [
      await contributeIx(payer, group, 0, recipient, h.mint),
    ]);
  });

  it("rejects a contribution from a non-member", async () => {
    const { creator, group, deposit } = await newGroup({ capacity: 3 });
    await fillSeats(group, 2, deposit * 4n);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipient = g.members[g.rotation[g.rotationPos]];
    const outsider = await h.wallet();
    await h.fundToken(outsider.address, deposit * 4n);
    await h.expectErr(outsider, [
      await contributeIx(outsider, group, 0, recipient, h.mint),
    ]);
  });

  it("will not let the crank redirect the payout", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      graceSecs: 0n,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    // one non-recipient pays, leaving the round not fully funded
    const oneSlot = liveSlots(g).find((s) => s !== recipientSlot)!;
    await h.expectOk(bySlot.get(oneSlot)!, [
      await contributeIx(bySlot.get(oneSlot)!, group, 0, recipient, h.mint),
    ]);
    h.clockForward(HOUR + 1n);

    const attacker = await h.wallet();
    await h.expectErr(attacker, [
      await disbursePayoutIx(attacker, group, 0, attacker.address, h.mint),
    ]);

    // legitimate crank still pays the right member
    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
    expect((await tokenBalanceAt(h.svm, recipient, h.mint)) - before).toBe(
      // 1 payer + 1 forfeited deposit == full pot
      contribution * 2n,
    );
  });

  it("blocks the crank during grace, allows a late contribution, then auto-pays", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      cycleSecs: HOUR,
      graceSecs: HOUR,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    const [p1, p2] = liveSlots(g).filter((s) => s !== recipientSlot);
    await h.expectOk(bySlot.get(p1)!, [
      await contributeIx(bySlot.get(p1)!, group, 0, recipient, h.mint),
    ]);

    // past the deadline, inside grace: crank rejected, contribution accepted
    h.clockForward(HOUR + 60n);
    await h.expectErr(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(bySlot.get(p2)!, [
      await contributeIx(bySlot.get(p2)!, group, 0, recipient, h.mint),
    ]);
    const after = await tokenBalanceAt(h.svm, recipient, h.mint);
    expect(after - before).toBe(contribution * 2n);
  });

  it("rejects a contribution after the grace window closes", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      cycleSecs: HOUR,
      graceSecs: 600n,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipient = g.members[g.rotation[g.rotationPos]];
    const late = liveSlots(g).find((s) => s !== g.rotation[g.rotationPos])!;
    h.clockForward(HOUR + 601n);
    await h.expectErr(bySlot.get(late)!, [
      await contributeIx(bySlot.get(late)!, group, 0, recipient, h.mint),
    ]);
  });

  it("opens the next cycle un-expired even after a very late crank", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      cycleSecs: HOUR,
      graceSecs: 0n,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 6n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await playRound(group, bySlot, deposit); // round 0 done

    // nobody touches the circle for a long time
    h.clockForward(HOUR * 5n);
    const nowBefore = h.svm.getClock().unixTimestamp;
    await h.expectOk(creator, [await openCycleIx(creator, group, 1)]);
    const c1 = await readCycle(group, 1);
    // deadline is anchored to open, not to the previous payout
    expect(c1.deadline).toBeGreaterThan(Number(nowBefore));
  });

  it("ejects a defaulter past grace, forfeiting their deposit into the round", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      cycleSecs: HOUR,
      graceSecs: 0n,
      rotations: 1,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    const [payer, noShow] = liveSlots(g).filter((s) => s !== recipientSlot);
    await h.expectOk(bySlot.get(payer)!, [
      await contributeIx(bySlot.get(payer)!, group, 0, recipient, h.mint),
    ]);

    h.clockForward(HOUR + 1n);
    const before = await tokenBalanceAt(h.svm, recipient, h.mint);
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);
    // 1 real payer + 1 forfeited deposit == the full 2-share pot
    expect((await tokenBalanceAt(h.svm, recipient, h.mint)) - before).toBe(
      contribution * 2n,
    );

    const after = readGroup(group);
    expect(after.ejected & (1 << noShow)).toBe(1 << noShow);
    expect(after.defaulted & (1 << noShow)).toBe(1 << noShow);
    expect(await vaultBalance(group)).toBe(deposit * 2n); // 2 live deposits

    // the ejected member cannot contribute to the next round
    await h.expectOk(creator, [await openCycleIx(creator, group, 1)]);
    const c1 = await readCycle(group, 1);
    expect(c1.required & (1 << noShow)).toBe(0);
    const r1 = readGroup(group);
    await h.expectErr(bySlot.get(noShow)!, [
      await contributeIx(
        bySlot.get(noShow)!,
        group,
        1,
        r1.members[r1.rotation[r1.rotationPos]],
        h.mint,
      ),
    ]);
  });

  it("collapses to Failed when ejection drops below two active members", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      cycleSecs: HOUR,
      graceSecs: 0n,
      rotations: 2,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 4n);
    const bySlot = rosterBySlot(group, creator, joiners);
    await h.expectOk(creator, [await openCycleIx(creator, group, 0)]);

    const g = readGroup(group);
    const recipientSlot = g.rotation[g.rotationPos];
    const recipient = g.members[recipientSlot];
    // nobody pays -> both non-recipients default
    h.clockForward(HOUR + 1n);
    await h.expectOk(creator, [
      await disbursePayoutIx(creator, group, 0, recipient, h.mint),
    ]);

    const after = readGroup(group);
    expect(after.status).toBe(FAILED);
    // a subsequent open_cycle is refused
    await h.expectErr(creator, [await openCycleIx(creator, group, 1)]);
    // the recipient can still withdraw their deposit
    await h.expectOk(bySlot.get(recipientSlot)!, [
      await closePositionIx(bySlot.get(recipientSlot)!, group, h.mint),
    ]);
  });

  it("lets a forming member leave with a refund, but not the creator", async () => {
    const { creator, group, deposit } = await newGroup({ capacity: 4 });
    const m = await h.wallet();
    await h.fundToken(m.address, deposit * 2n);
    await h.expectOk(m, [await joinGroupIx(m, group, h.mint)]);
    expect(readGroup(group).seatCount).toBe(2);
    expect(await vaultBalance(group)).toBe(deposit * 2n);

    const before = await tokenBalanceAt(h.svm, m.address, h.mint);
    await h.expectOk(m, [await leaveGroupIx(m, group, h.mint)]);
    expect(readGroup(group).seatCount).toBe(1);
    expect((await tokenBalanceAt(h.svm, m.address, h.mint)) - before).toBe(
      deposit,
    );

    await h.expectErr(creator, [await leaveGroupIx(creator, group, h.mint)]);
  });

  it("closes an unfilled circle, refunding the creator and both rents", async () => {
    const { creator, group, deposit } = await newGroup({ capacity: 3 });
    const before = await tokenBalanceAt(h.svm, creator.address, h.mint);
    await h.expectOk(creator, [await closeGroupIx(creator, group, h.mint)]);
    expect((await tokenBalanceAt(h.svm, creator.address, h.mint)) - before).toBe(
      deposit,
    );
    expect(h.svm.getAccount(group).exists).toBe(false);
  });

  it("refuses close_group once a second member has joined", async () => {
    const { creator, group, deposit } = await newGroup({ capacity: 3 });
    const m = await h.wallet();
    await h.fundToken(m.address, deposit * 2n);
    await h.expectOk(m, [await joinGroupIx(m, group, h.mint)]);
    await h.expectErr(creator, [await closeGroupIx(creator, group, h.mint)]);
  });

  it("runs an extension after unanimous opt-in", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      rotations: 1,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 20n);
    const bySlot = rosterBySlot(group, creator, joiners);
    for (let r = 0; r < 3; r++) await playRound(group, bySlot, deposit);
    expect(readGroup(group).status).toBe(COMPLETED);

    // non-creator cannot propose
    await h.expectErr(joiners[0], [
      await proposeExtensionIx(joiners[0], group, 1, 7200n),
    ]);

    await h.expectOk(creator, [
      await proposeExtensionIx(creator, group, 1, 7200n),
    ]);
    expect(readGroup(group).status).toBe(EXTENDING);
    // creator auto-opted-in; the two joiners still need to
    await h.expectOk(joiners[0], [await optInExtensionIx(joiners[0], group)]);
    expect(readGroup(group).status).toBe(EXTENDING);
    await h.expectOk(joiners[1], [await optInExtensionIx(joiners[1], group)]);

    const g = readGroup(group);
    expect(g.status).toBe(ACTIVE);
    expect(g.rotationsTarget).toBe(2);

    for (let r = 0; r < 3; r++) await playRound(group, bySlot, deposit);
    expect(readGroup(group).status).toBe(COMPLETED);
    expect(readGroup(group).rotationsDone).toBe(2);
  });

  it("one decline cancels the whole extension and refunds the decliner", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      rotations: 1,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 20n);
    const bySlot = rosterBySlot(group, creator, joiners);
    for (let r = 0; r < 3; r++) await playRound(group, bySlot, deposit);

    await h.expectOk(creator, [
      await proposeExtensionIx(creator, group, 1, 7200n),
    ]);
    await h.expectOk(joiners[0], [await optInExtensionIx(joiners[0], group)]);
    // joiners[1] declines by withdrawing — this kills the proposal for everyone
    const before = await tokenBalanceAt(h.svm, joiners[1].address, h.mint);
    await h.expectOk(joiners[1], [await closePositionIx(joiners[1], group, h.mint)]);
    expect(
      (await tokenBalanceAt(h.svm, joiners[1].address, h.mint)) - before,
    ).toBe(deposit);

    const g = readGroup(group);
    expect(g.status).toBe(COMPLETED);
    expect(g.rotationsTarget).toBe(1);
    expect(g.pendingRotations).toBe(0);
    expect(g.optinMask).toBe(0);
    // the two who stayed keep their deposits and can withdraw
    expect(liveSlots(g).length).toBe(2);
    for (const m of [creator, joiners[0]]) {
      await h.expectOk(m, [await closePositionIx(m, group, h.mint)]);
    }
    expect(await vaultBalance(group)).toBe(0n);
  });

  it("cancels a stale extension proposal once the opt-in window passes", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 3,
      rotations: 1,
    });
    const joiners = await fillSeats(group, 2, deposit + contribution * 20n);
    const bySlot = rosterBySlot(group, creator, joiners);
    for (let r = 0; r < 3; r++) await playRound(group, bySlot, deposit);

    await h.expectOk(creator, [
      await proposeExtensionIx(creator, group, 1, 3600n),
    ]);
    // nobody else opts in; window passes; a non-creator can clear it
    h.clockForward(3601n);
    await h.expectOk(joiners[0], [await cancelExtensionIx(joiners[0], group)]);
    expect(readGroup(group).status).toBe(COMPLETED);
    expect(readGroup(group).optinMask).toBe(0);

    // deposits still all withdrawable
    for (const m of [creator, ...joiners]) {
      await h.expectOk(m, [await closePositionIx(m, group, h.mint)]);
    }
    expect(await vaultBalance(group)).toBe(0n);
  });

  it("can seal and open round 1 in a single transaction (last join + open_cycle)", async () => {
    const { creator, group, deposit, contribution } = await newGroup({
      capacity: 2,
      rotations: 1,
    });
    const joiner = await h.wallet();
    await h.fundToken(joiner.address, deposit + contribution * 4n);
    // last join bundled with open_cycle for the global cycle 0
    await h.expectOk(joiner, [
      await joinGroupIx(joiner, group, h.mint),
      await openCycleIx(joiner, group, 0),
    ]);
    const g = readGroup(group);
    expect(g.status).toBe(ACTIVE);
    const c = await readCycle(group, 0);
    expect(c.disbursed).toBe(false);
    expect(c.required).toBe(0b11); // both seats on the hook
    expect(g.rotationLen).toBe(2);
    void creator;
  });

  it("refuses close_position while the circle is still running", async () => {
    const { creator, group, deposit } = await newGroup({ capacity: 3 });
    await fillSeats(group, 2, deposit * 2n);
    await h.expectErr(creator, [await closePositionIx(creator, group, h.mint)]);
  });
});

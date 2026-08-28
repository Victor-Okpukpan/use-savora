"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { Address } from "@solana/kit";
import type { Cycle, Group } from "@/generated";

import { ActivityFeed } from "@/components/activity-feed";
import { ConnectGate, Shell } from "@/components/shell";
import { InviteLink } from "@/components/invite-link";
import { PoolMeter } from "@/components/pool-meter";
import { PositionSummary } from "@/components/position-summary";
import { RequirePrivy } from "@/components/require-privy";
import { RosterList } from "@/components/roster-list";
import { RotationTrack } from "@/components/rotation-track";
import { Button, Card, Fade, PendingBar } from "@/components/ui";
import { deriveActivity, totalMissed } from "@/lib/savora/activity";
import { DEMO, DEMO_LABELS } from "@/lib/savora/demo";
import {
  decodeName,
  formatShortDate,
  formatUsdc,
  shortAddress,
} from "@/lib/savora/format";
import {
  useCurrentCycle,
  useCycleHistory,
  useGroup,
  useNow,
} from "@/lib/savora/hooks";
import { computePosition } from "@/lib/savora/position";
import { useConnection, useSavora } from "@/lib/savora/use-savora";

const STATUS = ["Forming", "Active", "Completed"] as const;

type GroupView = {
  d: Group;
  myIndex: number;
  isMember: boolean;
  cycle: Cycle | null;
  cycleExists: boolean;
  iPaid: boolean;
  funded: boolean;
  pastDeadline: boolean;
  crankable: boolean;
  recipient: Address;
  recipientIndex: number;
};

export default function GroupPage() {
  return (
    <Shell width="max-w-reading">
      <RequirePrivy>
        <GroupDetail />
      </RequirePrivy>
    </Shell>
  );
}

function GroupDetail() {
  const params = useParams<{ address: string }>();
  const groupAddress = params.address as Address;

  const { authenticated, ready, address: me } = useConnection();
  const groupQ = useGroup(groupAddress);
  const group = groupQ.data ?? null;
  const cycleQ = useCurrentCycle(group);
  const historyQ = useCycleHistory(group);
  const savora = useSavora();
  const nowSec = useNow();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels = DEMO ? DEMO_LABELS : undefined;

  const refresh = () => {
    groupQ.refetch();
    cycleQ.refetch();
    historyQ.refetch();
  };

  async function act(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const view = useMemo<GroupView | null>(() => {
    if (!group || !me) return null;
    const d = group.data;
    const myIndex = d.members.slice(0, d.memberCount).indexOf(me as never);
    const isMember = myIndex >= 0;
    const cycle = cycleQ.data?.data ?? null;
    const cycleExists = !!cycleQ.data;
    const iPaid = cycle ? (cycle.contributed & (1 << myIndex)) !== 0 : false;
    const funded = cycle ? cycle.contributorCount === d.memberCount : false;
    const pastDeadline = cycle ? nowSec > Number(cycle.deadline) : false;
    const crankable =
      d.status === 1 &&
      cycle != null &&
      !cycle.disbursed &&
      (funded || pastDeadline);
    const recipientIndex = cycle
      ? cycle.recipientIndex
      : d.status === 1
        ? d.rotation[d.currentCycle]
        : 0;
    return {
      d,
      myIndex,
      isMember,
      cycle,
      cycleExists,
      iPaid,
      funded,
      pastDeadline,
      crankable,
      recipient: d.members[recipientIndex] as Address,
      recipientIndex,
    };
  }, [group, me, cycleQ.data, nowSec]);

  const position = useMemo(() => {
    if (!group || !me || !historyQ.data) return null;
    return computePosition(group, historyQ.data, me);
  }, [group, me, historyQ.data]);

  const events = useMemo(() => {
    if (!group || !historyQ.data) return [];
    return deriveActivity(group, historyQ.data);
  }, [group, historyQ.data]);

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;
  if (groupQ.isLoading)
    return <p className="text-[13px] text-ink-muted">Loading circle…</p>;
  if (!group)
    return (
      <Card className="p-8 text-center">
        <h2 className="text-[15px] font-medium text-ink">Circle not found</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          This invite link doesn&rsquo;t point to a circle on devnet.
        </p>
        <div className="mt-4 flex justify-center">
          <Link href="/app">
            <Button variant="secondary">Back to your circles</Button>
          </Link>
        </div>
      </Card>
    );
  if (!view) return null;

  const d = view.d;
  const members = d.members.slice(0, d.memberCount) as Address[];
  const target = d.contribution * BigInt(d.memberCount);
  const missed = totalMissed(group);

  return (
    <Fade className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-serif text-[34px] leading-none text-ink">
            {decodeName(d.name) || "Untitled circle"}
          </h1>
          <span className="rounded-pill border border-line px-2 py-0.5 text-[11px] text-ink-muted">
            {STATUS[d.status]}
          </span>
        </div>
        <p className="tnum mt-2 text-[13px] text-ink-muted">
          {formatUsdc(d.contribution)} USDC per round · {d.memberCount}/
          {d.capacity} seats
          {d.status === 1
            ? ` · round ${d.currentCycle + 1} of ${d.memberCount}`
            : ""}
          {missed > 0 ? ` · ${missed} missed contribution${missed === 1 ? "" : "s"}` : ""}
        </p>
      </header>

      {view.isMember && position ? <PositionSummary position={position} /> : null}

      {d.status === 0 ? (
        <FormingPanel
          groupAddress={groupAddress}
          seatsLeft={d.capacity - d.memberCount}
          isMember={view.isMember}
          isCreator={view.myIndex === 0}
          busy={busy}
          onJoin={() => act("join", () => savora.joinGroup(groupAddress))}
          onLeave={() => act("leave", () => savora.leaveGroup(groupAddress))}
        />
      ) : (
        <ActivePanel
          view={view}
          target={target}
          busy={busy}
          onContribute={() =>
            act("contribute", () =>
              savora.contribute(
                groupAddress,
                d.currentCycle,
                !view.cycleExists,
              ),
            )
          }
          onCrank={() =>
            act("crank", () =>
              savora.disburse(groupAddress, d.currentCycle, view.recipient),
            )
          }
        />
      )}

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      {d.status !== 0 ? (
        <section>
          <h2 className="micro mb-2.5">Rotation</h2>
          <RotationTrack
            members={members}
            rotation={d.rotation}
            memberCount={d.memberCount}
            currentCycle={d.currentCycle}
            status={d.status}
            me={me!}
            labels={labels}
          />
        </section>
      ) : null}

      <RosterList
        members={members}
        rotation={d.rotation}
        missed={d.missed}
        memberCount={d.memberCount}
        status={d.status}
        currentCycle={d.currentCycle}
        me={me!}
        contributedMask={view.cycle?.contributed ?? 0}
        labels={labels}
        editableNicknames={!DEMO}
      />

      {events.length > 0 ? (
        <section>
          <h2 className="micro mb-2.5">Activity</h2>
          <ActivityFeed events={events} members={members} labels={labels} />
        </section>
      ) : null}

      <p className="text-[12px] text-ink-faint">
        Need devnet SOL or USDC?{" "}
        <Link href="/app/profile" className="text-accent hover:underline">
          Fund your wallet
        </Link>{" "}
        on your profile.
      </p>
    </Fade>
  );
}

function FormingPanel({
  groupAddress,
  seatsLeft,
  isMember,
  isCreator,
  busy,
  onJoin,
  onLeave,
}: {
  groupAddress: string;
  seatsLeft: number;
  isMember: boolean;
  isCreator: boolean;
  busy: string | null;
  onJoin: () => void;
  onLeave: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink">
            Waiting for members
          </span>
          <span className="tnum text-[13px] text-ink-muted">
            {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
          </span>
        </div>

        <InviteLink groupAddress={groupAddress} />

        <PendingBar active={!!busy} />
        <div className="flex gap-2">
          {!isMember ? (
            <Button
              loading={busy === "join"}
              disabled={seatsLeft === 0}
              onClick={onJoin}
            >
              Join this circle
            </Button>
          ) : isCreator ? (
            <span className="text-[13px] text-ink-muted">
              You started this circle. It begins automatically when the last seat
              fills.
            </span>
          ) : (
            <Button variant="danger" loading={busy === "leave"} onClick={onLeave}>
              Leave
            </Button>
          )}
        </div>

        <p className="border-t border-line pt-4 text-[12px] leading-[1.7] text-ink-faint">
          When the last seat fills, the collection order is shuffled on-chain and
          fixed for good — no one picks it. A block producer controlling the exact
          sealing moment could bias the shuffle; for a circle of people who know
          each other, that&rsquo;s a trade we make openly.
        </p>
      </div>
    </Card>
  );
}

function ActivePanel({
  view,
  target,
  busy,
  onContribute,
  onCrank,
}: {
  view: GroupView;
  target: bigint;
  busy: string | null;
  onContribute: () => void;
  onCrank: () => void;
}) {
  const { d, cycle, iPaid, funded, crankable, isMember } = view;

  if (d.status === 2) {
    return (
      <Card className="p-6">
        <p className="text-[13px] text-ink-muted">
          Every member has collected. This circle is complete.
        </p>
      </Card>
    );
  }

  const paidCount = cycle?.contributorCount ?? 0;
  const recipient = d.members[view.recipientIndex];

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <span className="text-[13px]">
          <span className="text-ink-muted">Collecting this round · </span>
          <span className="addr font-medium text-ink">
            {view.recipientIndex === view.myIndex
              ? "you"
              : shortAddress(recipient)}
          </span>
        </span>
        {cycle ? (
          <span className="tnum text-[12px] text-ink-muted">
            deadline {formatShortDate(cycle.deadline)}
          </span>
        ) : null}
      </div>

      <div className="pt-5">
        <PoolMeter
          pooled={cycle?.pooled ?? 0n}
          target={target}
          paidCount={paidCount}
          memberCount={d.memberCount}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        <PendingBar active={!!busy} />
        {!isMember ? (
          crankable ? (
            <Button loading={busy === "crank"} onClick={onCrank}>
              Send this round&rsquo;s payout
            </Button>
          ) : (
            <p className="text-[13px] text-ink-muted">
              You&rsquo;re not in this circle. Anyone can trigger the payout once
              the round is funded.
            </p>
          )
        ) : crankable ? (
          <>
            <Button loading={busy === "crank"} onClick={onCrank}>
              {funded
                ? "Round is funded — send the payout"
                : "Deadline passed — pay out what’s in"}
            </Button>
            {!iPaid ? (
              <button
                onClick={onContribute}
                className="text-[12px] text-ink-muted underline-offset-2 hover:underline"
              >
                or contribute your share first
              </button>
            ) : null}
          </>
        ) : iPaid ? (
          <p className="text-[13px] text-ink-muted">
            You&rsquo;ve paid this round. Waiting on {d.memberCount - paidCount}{" "}
            more.
          </p>
        ) : (
          <Button loading={busy === "contribute"} onClick={onContribute}>
            Contribute {formatUsdc(d.contribution)} USDC
          </Button>
        )}
      </div>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { Address } from "@solana/kit";

import { Button, Card, Fade, PendingBar, Stat } from "@/components/ui";
import { ConnectGate, Shell } from "@/components/shell";
import { RequirePrivy } from "@/components/require-privy";
import { DevnetFaucet } from "@/components/devnet-faucet";
import { InviteLink } from "@/components/invite-link";
import { RosterList } from "@/components/roster-list";
import { formatUsdc, decodeName, shortAddress } from "@/lib/savora/format";
import {
  useCurrentCycle,
  useCycleHistory,
  useGroup,
  useNow,
} from "@/lib/savora/hooks";
import { useConnection, useSavora } from "@/lib/savora/use-savora";
import type { Cycle, Group } from "@/generated";

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
    <Shell width="max-w-3xl">
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
    const funded = cycle
      ? cycle.contributorCount === d.memberCount
      : false;
    const pastDeadline = cycle ? nowSec > Number(cycle.deadline) : false;
    const crankable =
      d.status === 1 && cycle != null && !cycle.disbursed && (funded || pastDeadline);
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

  if (!ready) return null;

  return (
    <>
      {!authenticated ? (
        <ConnectGate />
      ) : groupQ.isLoading ? (
        <p className="text-[13px] text-ink-muted">Loading circle…</p>
      ) : !group ? (
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
      ) : view ? (
        <Fade className="flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-[32px] leading-tight text-ink">
                {decodeName(view.d.name) || "Untitled circle"}
              </h1>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                {["Forming", "Active", "Completed"][view.d.status]}
              </span>
            </div>
            <p className="mt-1 tnum text-[13px] text-ink-muted">
              {formatUsdc(view.d.contribution)} USDC per round ·{" "}
              {view.d.memberCount}/{view.d.capacity} seats
              {view.d.status === 1
                ? ` · round ${view.d.currentCycle + 1} of ${view.d.memberCount}`
                : ""}
            </p>
          </header>

          {view.d.status === 0 ? (
            <FormingPanel
              groupAddress={groupAddress}
              seatsLeft={view.d.capacity - view.d.memberCount}
              isMember={view.isMember}
              isCreator={view.myIndex === 0}
              busy={busy}
              onJoin={() =>
                act("join", () => savora.joinGroup(groupAddress))
              }
              onLeave={() =>
                act("leave", () => savora.leaveGroup(groupAddress))
              }
            />
          ) : (
            <ActivePanel
              view={view}
              busy={busy}
              onContribute={() =>
                act("contribute", () =>
                  savora.contribute(
                    groupAddress,
                    view.d.currentCycle,
                    !view.cycleExists,
                  ),
                )
              }
              onCrank={() =>
                act("crank", () =>
                  savora.disburse(
                    groupAddress,
                    view.d.currentCycle,
                    view.recipient,
                  ),
                )
              }
            />
          )}

          {error ? (
            <p className="text-[12px] text-danger">{error}</p>
          ) : null}

          <RosterList
            members={view.d.members.slice(0, view.d.memberCount) as Address[]}
            rotation={view.d.rotation}
            missed={view.d.missed}
            memberCount={view.d.memberCount}
            status={view.d.status}
            currentCycle={view.d.currentCycle}
            me={me!}
            contributedMask={view.cycle?.contributed ?? 0}
          />

          {historyQ.data && historyQ.data.length > 0 ? (
            <section>
              <h2 className="mb-2 text-[13px] font-medium text-ink">
                Rounds
              </h2>
              <div className="overflow-hidden rounded-card border border-line">
                {historyQ.data.map((c) => {
                  const recipient = view.d.members[c.data.recipientIndex];
                  return (
                    <div
                      key={c.data.index}
                      className="flex items-center justify-between border-b border-line px-4 py-3 text-[13px] last:border-0"
                    >
                      <span className="tnum text-ink-muted">
                        Round {c.data.index + 1}
                      </span>
                      <span className="addr text-ink-muted">
                        {shortAddress(recipient)}
                      </span>
                      <span className="tnum text-ink">
                        {c.data.disbursed
                          ? `${formatUsdc(c.data.payout)} USDC`
                          : `${formatUsdc(c.data.pooled)} in`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <DevnetFaucet address={me!} />
        </Fade>
      ) : null}
    </>
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
            <Button loading={busy === "join"} disabled={seatsLeft === 0} onClick={onJoin}>
              Join this circle
            </Button>
          ) : isCreator ? (
            <span className="text-[13px] text-ink-muted">
              You started this circle. It begins automatically when the last
              seat fills.
            </span>
          ) : (
            <Button
              variant="danger"
              loading={busy === "leave"}
              onClick={onLeave}
            >
              Leave
            </Button>
          )}
        </div>

        <p className="border-t border-line pt-4 text-[12px] leading-[1.7] text-ink-faint">
          When the last seat fills, the collection order is shuffled on-chain and
          fixed for good — no one picks it. A block producer controlling the
          exact sealing moment could bias the shuffle; for a circle of people
          who know each other, that&rsquo;s a trade we make openly.
        </p>
      </div>
    </Card>
  );
}

function ActivePanel({
  view,
  busy,
  onContribute,
  onCrank,
}: {
  view: GroupView;
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
  const deadline = cycle ? new Date(Number(cycle.deadline) * 1000) : null;
  const recipient = d.members[view.recipientIndex];

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-2 border-b border-line pb-4 text-[13px]">
        <span className="text-ink-muted">Collecting this round</span>
        <span className="addr font-medium text-ink">
          {view.recipientIndex === view.myIndex
            ? "you"
            : shortAddress(recipient)}
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Stat
          label="This round"
          value={formatUsdc(cycle?.pooled ?? 0n, { fixed: true })}
          sub={`of ${formatUsdc(d.contribution * BigInt(d.memberCount), { fixed: true })} USDC`}
        />
        <Stat label="Paid in" value={`${paidCount}/${d.memberCount}`} />
        <Stat
          label="Deadline"
          value={
            deadline
              ? deadline.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "—"
          }
          sub={
            deadline
              ? deadline.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : undefined
          }
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
            You&rsquo;ve paid this round. Waiting on{" "}
            {d.memberCount - paidCount} more.
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


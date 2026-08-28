"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import type { Address } from "@solana/kit";
import type { Cycle, Group } from "@/generated";

import { ActivityFeed } from "@/components/activity-feed";
import { useBalances } from "@/lib/savora/balances";
import { ConnectGate, Shell } from "@/components/shell";
import { InviteLink } from "@/components/invite-link";
import { PoolMeter } from "@/components/pool-meter";
import { PositionSummary } from "@/components/position-summary";
import { RequirePrivy } from "@/components/require-privy";
import { RosterList } from "@/components/roster-list";
import { RotationTrack } from "@/components/rotation-track";
import { Button, Card, Fade, PendingBar } from "@/components/ui";
import { deriveActivity, totalDefaulted } from "@/lib/savora/activity";
import { DEMO, DEMO_LABELS } from "@/lib/savora/demo";
import {
  decodeName,
  formatCountdown,
  formatUsdc,
  shortAddress,
} from "@/lib/savora/format";
import {
  GroupStatus,
  STATUS_LABEL,
  activeCount,
  isEjected,
  isFullyFunded,
  isLive,
  owingCount,
  paidCount,
  roundPhase,
  roundTarget,
  seatAddresses,
  slotOf,
} from "@/lib/savora/group";
import {
  useCurrentCycle,
  useCycleHistory,
  useGroup,
  useNow,
} from "@/lib/savora/hooks";
import { computePosition } from "@/lib/savora/position";
import { useConnection, useSavora } from "@/lib/savora/use-savora";

type GroupView = {
  d: Group;
  myIndex: number;
  isMember: boolean;
  amMember: boolean; // member and still live
  cycle: Cycle | null;
  cycleExists: boolean;
  atBoundary: boolean;
  iPaid: boolean;
  funded: boolean;
  crankable: boolean;
  recipient: Address | null;
  recipientIndex: number | null;
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
  const nowSec = useNow(1000);
  const balances = useBalances(me ?? null);
  const usdc = balances.data?.usdc ?? null;

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
    const myIndex = slotOf(d, me);
    const isMember = myIndex >= 0;
    const amMember = isMember && isLive(d, myIndex);
    const cycle = cycleQ.data?.data ?? null;
    const cycleExists = !!cycleQ.data;
    const atBoundary = d.rotationPos >= d.rotationLen;

    const iPaid =
      cycle && myIndex >= 0
        ? (cycle.contributed & (1 << myIndex)) !== 0
        : false;
    const funded = cycle ? isFullyFunded(cycle) : false;
    const phase = roundPhase(d, cycle, nowSec);
    const crankable =
      d.status === GroupStatus.Active &&
      cycle != null &&
      !cycle.disbursed &&
      phase.kind === "payable";

    let recipientIndex: number | null = null;
    if (cycle) recipientIndex = cycle.recipientIndex;
    else if (d.status === GroupStatus.Active && !atBoundary)
      recipientIndex = d.rotation[d.rotationPos];

    return {
      d,
      myIndex,
      isMember,
      amMember,
      cycle,
      cycleExists,
      atBoundary,
      iPaid,
      funded,
      crankable,
      recipient:
        recipientIndex != null
          ? (d.members[recipientIndex] as Address)
          : null,
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
  const members = seatAddresses(d);
  const defaulted = totalDefaulted(group);
  const running = d.status === GroupStatus.Active;

  return (
    <Fade className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-serif text-[34px] leading-none text-ink">
            {decodeName(d.name) || "Untitled circle"}
          </h1>
          <span className="rounded-pill border border-line px-2 py-0.5 text-[11px] text-ink-muted">
            {STATUS_LABEL[d.status]}
          </span>
        </div>
        <p className="tnum mt-2 text-[13px] text-ink-muted">
          {formatUsdc(d.contribution)} USDC per round · {d.seatCount}/{d.capacity}{" "}
          seats · {formatUsdc(d.deposit)} deposit
          {running
            ? d.rotationsTarget > 1
              ? ` · rotation ${d.rotationsDone + 1}/${d.rotationsTarget}, round ${d.rotationPos + 1}`
              : ` · round ${d.rotationPos + 1} of ${d.rotationLen || d.seatCount}`
            : ""}
          {defaulted > 0
            ? ` · ${defaulted} ejected for missing a round`
            : ""}
        </p>
      </header>

      {view.isMember && position ? (
        <PositionSummary position={position} />
      ) : null}

      {d.status === GroupStatus.Forming ? (
        <FormingPanel
          groupAddress={groupAddress}
          seatsLeft={d.capacity - d.seatCount}
          deposit={d.deposit}
          contribution={d.contribution}
          fundsShort={
            balances.data != null &&
            !view.isMember &&
            (usdc == null || usdc < d.deposit)
          }
          isMember={view.isMember}
          isCreator={view.myIndex === 0}
          busy={busy}
          onJoin={() =>
            act("join", () =>
              // Filling the last seat also opens round 1 in the same tx.
              savora.joinGroup(groupAddress, d.capacity - d.seatCount === 1),
            )
          }
          onLeave={() => act("leave", () => savora.leaveGroup(groupAddress))}
          onClose={() =>
            act("close", () => savora.closeGroup(groupAddress))
          }
        />
      ) : d.status === GroupStatus.Active ? (
        <ActivePanel
          view={view}
          nowSec={nowSec}
          busy={busy}
          onOpen={() =>
            act("open", () => savora.openCycle(groupAddress, d.currentCycle))
          }
          onContribute={() =>
            act("contribute", () =>
              savora.contribute(
                groupAddress,
                d.currentCycle,
                view.recipient!,
                !view.cycleExists,
              ),
            )
          }
          onCrank={() =>
            act("crank", () =>
              savora.disburse(groupAddress, d.currentCycle, view.recipient!),
            )
          }
        />
      ) : d.status === GroupStatus.Extending ? (
        <ExtendingPanel
          view={view}
          nowSec={nowSec}
          busy={busy}
          onOptIn={() =>
            act("optin", () => savora.optInExtension(groupAddress))
          }
          onDecline={() =>
            act("decline", () => savora.closePosition(groupAddress))
          }
          onCancel={() =>
            act("cancel", () => savora.cancelExtension(groupAddress))
          }
        />
      ) : (
        <EndedPanel
          view={view}
          busy={busy}
          onWithdraw={() =>
            act("withdraw", () => savora.closePosition(groupAddress))
          }
          onPropose={(rot, secs) =>
            act("propose", () =>
              savora.proposeExtension(groupAddress, rot, secs),
            )
          }
        />
      )}

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}

      {d.status !== GroupStatus.Forming && d.rotationLen > 0 ? (
        <section>
          <h2 className="micro mb-2.5">This rotation</h2>
          <RotationTrack
            members={members}
            rotation={d.rotation}
            rotationLen={d.rotationLen}
            rotationPos={d.rotationPos}
            active={running}
            me={me!}
            labels={labels}
          />
        </section>
      ) : null}

      <RosterList
        group={d}
        me={me!}
        contributedMask={view.cycle?.contributed ?? 0}
        requiredMask={view.cycle?.required ?? 0}
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

/* ---------------- Forming ---------------- */

function FormingPanel({
  groupAddress,
  seatsLeft,
  deposit,
  contribution,
  fundsShort,
  isMember,
  isCreator,
  busy,
  onJoin,
  onLeave,
  onClose,
}: {
  groupAddress: string;
  seatsLeft: number;
  deposit: bigint;
  contribution: bigint;
  fundsShort: boolean;
  isMember: boolean;
  isCreator: boolean;
  busy: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onClose: () => void;
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
        <div className="flex flex-wrap gap-2">
          {!isMember ? (
            <Button
              loading={busy === "join"}
              disabled={seatsLeft === 0 || fundsShort}
              onClick={onJoin}
            >
              Join · lock {formatUsdc(deposit)} USDC deposit
            </Button>
          ) : isCreator ? (
            <span className="text-[13px] text-ink-muted">
              You started this circle. It begins automatically when the last
              seat fills. If nobody joins, you can close it and get your deposit
              back.
            </span>
          ) : (
            <Button variant="danger" loading={busy === "leave"} onClick={onLeave}>
              Leave · refund deposit
            </Button>
          )}
          {isCreator && seatsLeft === Math.max(0, seatsLeft) && isMember ? (
            <Button
              variant="secondary"
              loading={busy === "close"}
              onClick={onClose}
            >
              Close circle
            </Button>
          ) : null}
        </div>

        {fundsShort ? (
          <p className="text-[12px] text-warning">
            You need {formatUsdc(deposit)} USDC to lock the deposit. Get devnet
            USDC on your{" "}
            <Link href="/app/profile" className="text-accent hover:underline">
              profile
            </Link>
            .
          </p>
        ) : null}

        <p className="border-t border-line pt-4 text-[12px] leading-[1.7] text-ink-faint">
          Joining locks a {formatUsdc(deposit)} USDC deposit; then you contribute{" "}
          {formatUsdc(contribution)} USDC each round. The deposit is refunded
          when the circle completes and you withdraw — it&rsquo;s forfeited only
          if you miss a round. When the last seat fills, the collection order is
          shuffled onchain and no one picks it.
        </p>
      </div>
    </Card>
  );
}

/* ---------------- Active ---------------- */

function ActivePanel({
  view,
  nowSec,
  busy,
  onOpen,
  onContribute,
  onCrank,
}: {
  view: GroupView;
  nowSec: number;
  busy: string | null;
  onOpen: () => void;
  onContribute: () => void;
  onCrank: () => void;
}) {
  const { d, cycle, cycleExists, atBoundary, iPaid, funded, crankable, amMember } =
    view;
  const amRecipient =
    view.recipientIndex != null && view.recipientIndex === view.myIndex;

  // No cycle yet this round.
  if (!cycleExists) {
    if (atBoundary) {
      return (
        <Card className="p-6">
          <p className="text-[13px] text-ink-muted">
            Round {d.rotationPos + 1} of {d.rotationLen || d.seatCount} hasn&rsquo;t
            opened yet. Opening it shuffles the collection order for this
            rotation.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <PendingBar active={!!busy} />
            <Button loading={busy === "open"} onClick={onOpen}>
              Open round {d.rotationPos + 1}
            </Button>
          </div>
        </Card>
      );
    }
    // Non-boundary: recipient is known. A non-recipient member's contribution
    // bundles the open; the recipient (who owes nothing) just opens it.
    return (
      <Card className="p-6">
        <RecipientLine view={view} />
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <PendingBar active={!!busy} />
          {amRecipient ? (
            <>
              <Button loading={busy === "open"} onClick={onOpen}>
                Open round {d.rotationPos + 1}
              </Button>
              <p className="text-[12px] text-ink-faint">
                You collect this round — nothing to pay in. Opening it lets the
                others contribute; the last contribution pays you out.
              </p>
            </>
          ) : amMember ? (
            <Button loading={busy === "contribute"} onClick={onContribute}>
              Contribute {formatUsdc(d.contribution)} USDC
            </Button>
          ) : (
            <p className="text-[13px] text-ink-muted">
              This round hasn&rsquo;t opened. Any member can start it by
              contributing.
            </p>
          )}
        </div>
      </Card>
    );
  }

  const phase = roundPhase(d, cycle, nowSec);
  const paid = cycle ? paidCount(cycle) : 0;
  const need = activeCount(d) - 1;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <RecipientLine view={view} />
        <PhaseTag phase={phase} nowSec={nowSec} />
      </div>

      <div className="pt-5">
        <PoolMeter
          pooled={cycle?.pooled ?? 0n}
          target={roundTarget(d)}
          paidCount={paid}
          need={need}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
        <PendingBar active={!!busy} />
        {crankable ? (
          <>
            <Button loading={busy === "crank"} onClick={onCrank}>
              {funded
                ? "Round is funded — send the payout"
                : "Grace over — pay out and eject no-shows"}
            </Button>
            {amMember && !iPaid ? (
              <p className="text-[12px] text-warning">
                You haven&rsquo;t contributed. Cranking now ejects you and
                forfeits your deposit.
              </p>
            ) : null}
          </>
        ) : !amMember ? (
          <p className="text-[13px] text-ink-muted">
            You&rsquo;re not in this circle. Anyone can trigger the payout once
            the round is funded or the grace window closes.
          </p>
        ) : amRecipient ? (
          <p className="text-[13px] text-ink-muted">
            You collect this round — nothing to pay in. Waiting on{" "}
            {owingCount(cycle!)} contribution
            {owingCount(cycle!) === 1 ? "" : "s"}; the last one pays you out.
          </p>
        ) : iPaid ? (
          <p className="text-[13px] text-ink-muted">
            You&rsquo;ve paid this round. Waiting on {owingCount(cycle!)} more.
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

function RecipientLine({ view }: { view: GroupView }) {
  const { recipientIndex, myIndex } = view;
  return (
    <span className="text-[13px]">
      <span className="text-ink-muted">Collecting this round · </span>
      <span className="addr font-medium text-ink">
        {recipientIndex == null
          ? "set when the round opens"
          : recipientIndex === myIndex
            ? "you"
            : shortAddress(view.d.members[recipientIndex])}
      </span>
    </span>
  );
}

function PhaseTag({
  phase,
  nowSec,
}: {
  phase: ReturnType<typeof roundPhase>;
  nowSec: number;
}) {
  if (phase.kind === "open")
    return (
      <span className="tnum text-[12px] text-ink-muted">
        closes in {formatCountdown(phase.deadline, nowSec)}
      </span>
    );
  if (phase.kind === "grace")
    return (
      <span className="tnum text-[12px] text-warning">
        grace · {formatCountdown(phase.graceEnd, nowSec)} left to pay
      </span>
    );
  if (phase.kind === "payable")
    return <span className="text-[12px] font-medium text-accent">payable</span>;
  return null;
}

/* ---------------- Extending ---------------- */

function ExtendingPanel({
  view,
  nowSec,
  busy,
  onOptIn,
  onDecline,
  onCancel,
}: {
  view: GroupView;
  nowSec: number;
  busy: string | null;
  onOptIn: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const { d, myIndex, amMember } = view;
  const optedIn = myIndex >= 0 && (d.optinMask & (1 << myIndex)) !== 0;
  const isCreator = myIndex === 0;
  const yes = (() => {
    let c = 0;
    for (let i = 0; i < d.seatCount; i++)
      if (isLive(d, i) && d.optinMask & (1 << i)) c++;
    return c;
  })();

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-ink">
            Extension proposed · +{d.pendingRotations} rotation
            {d.pendingRotations === 1 ? "" : "s"}
          </span>
          <span className="tnum text-[12px] text-ink-muted">
            {yes}/{activeCount(d)} in ·{" "}
            {formatCountdown(d.optinDeadline, nowSec)} left
          </span>
        </div>
        <p className="text-[12px] leading-[1.7] text-ink-faint">
          Every member has to agree. Opting in keeps your deposit in and commits
          you to another full rotation. Declining withdraws your deposit and
          ends your membership — permanently.
        </p>

        <PendingBar active={!!busy} />
        <div className="flex flex-wrap gap-2">
          {amMember && !optedIn ? (
            <>
              <Button loading={busy === "optin"} onClick={onOptIn}>
                Opt in
              </Button>
              <Button
                variant="danger"
                loading={busy === "decline"}
                onClick={onDecline}
              >
                Decline · withdraw deposit
              </Button>
            </>
          ) : optedIn ? (
            <span className="text-[13px] text-ink-muted">
              You&rsquo;ve opted in. Waiting on the rest.
            </span>
          ) : (
            <span className="text-[13px] text-ink-muted">
              You&rsquo;re not an active member of this circle.
            </span>
          )}
          {(isCreator || nowSec > Number(d.optinDeadline)) && (
            <Button
              variant="secondary"
              loading={busy === "cancel"}
              onClick={onCancel}
            >
              {isCreator ? "Cancel proposal" : "Clear stale proposal"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Completed / Failed ---------------- */

function EndedPanel({
  view,
  busy,
  onWithdraw,
  onPropose,
}: {
  view: GroupView;
  busy: string | null;
  onWithdraw: () => void;
  onPropose: (rotations: number, optinSecs: bigint) => void;
}) {
  const { d, myIndex, amMember } = view;
  const failed = d.status === GroupStatus.Failed;
  const isCreator = myIndex === 0;
  const [rot, setRot] = useState(1);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-ink-muted">
          {failed
            ? "This circle collapsed — too few active members to continue. Withdraw any deposit you still have in."
            : d.rotationsDone > 1
              ? `All ${d.rotationsDone} rotations are complete.`
              : "Every member has collected. This circle is complete."}
        </p>

        <PendingBar active={!!busy} />

        {amMember ? (
          <Button
            variant={failed ? "primary" : "secondary"}
            loading={busy === "withdraw"}
            onClick={onWithdraw}
          >
            Withdraw {formatUsdc(d.deposit)} USDC deposit
          </Button>
        ) : (
          <p className="text-[12px] text-ink-faint">
            {isEjected(d, myIndex)
              ? "You were ejected from this circle; your deposit was forfeited."
              : "You have nothing to withdraw here."}
          </p>
        )}

        {!failed && isCreator && amMember ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="micro">Run it again</span>
            <p className="text-[12px] leading-[1.6] text-ink-faint">
              Propose more rotations. It only starts once every member opts in.
              Withdrawing your deposit first would forfeit your ability to
              propose.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRot(n)}
                    className={`tnum h-9 w-9 rounded-control border text-[13px] ${
                      rot === n
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-line bg-surface text-ink-muted hover:bg-surface-sunk"
                    }`}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <Button
                loading={busy === "propose"}
                onClick={() => onPropose(rot, 259_200n)}
              >
                Propose extension
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

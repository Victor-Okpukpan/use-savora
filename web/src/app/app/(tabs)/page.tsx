"use client";

import Link from "next/link";

import type { Address } from "@solana/kit";

import { MemberMark } from "@/components/member-identity";
import { Button, Card, Fade } from "@/components/ui";
import { ConnectGate } from "@/components/shell";
import { decodeName, formatUsdc, rotationPosition } from "@/lib/savora/format";
import { useCurrentCycles, useMyGroups, useNow } from "@/lib/savora/hooks";
import type { CycleAccount } from "@/lib/savora/hooks";
import { useConnection } from "@/lib/savora/use-savora";
import type { GroupAccount } from "@/lib/savora/queries";

const STATUS_LABEL = ["Forming", "Active", "Completed"] as const;

export default function CirclesTab() {
  const { authenticated, ready, address } = useConnection();
  const groups = useMyGroups(address);
  const cycles = useCurrentCycles(groups.data);
  const now = useNow();

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;
  if (groups.isLoading)
    return <p className="text-[13px] text-ink-muted">Loading…</p>;
  if (groups.isError)
    return (
      <Card className="p-8 text-center">
        <h2 className="text-[15px] font-medium text-ink">
          Couldn&rsquo;t load your circles
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-[1.6] text-ink-muted">
          The RPC didn&rsquo;t answer. Your circles are safe onchain — this is
          just the read. Try again in a moment.
        </p>
        <div className="mt-5 flex justify-center">
          <Button onClick={() => groups.refetch()}>Retry</Button>
        </div>
      </Card>
    );

  const data = groups.data ?? [];
  if (data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-[15px] font-medium text-ink">No circles yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-[1.6] text-ink-muted">
          Start one and share the link, or paste an invite link a friend sent you
          into your browser to join theirs.
        </p>
        <div className="mt-5 flex justify-center">
          <Link href="/app/new">
            <Button>Start a circle</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const me = address!;
  const todos = data
    .map((g) => actionFor(g, cycles.byGroup.get(g.address) ?? null, me, now))
    .filter((t): t is Todo => t !== null);

  return (
    <div className="flex flex-col gap-8">
      <AggregateBar groups={data} me={me} />

      {todos.length > 0 ? (
        <section>
          <h2 className="micro mb-2.5">Needs you</h2>
          <ul className="flex flex-col gap-2">
            {todos.map((t) => (
              <li key={t.address}>
                <Link
                  href={`/g/${t.address}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent/5 px-4 py-3 transition-colors hover:bg-accent/10"
                >
                  <span className="flex items-center gap-2 text-[13px]">
                    <span className="size-1.5 rounded-full bg-accent" />
                    <span className="font-medium text-ink">{t.circle}</span>
                    <span className="text-ink-muted">{t.text}</span>
                  </span>
                  <span className="text-[12px] text-accent">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="micro mb-2.5">Your circles</h2>
        <ul className="flex flex-col gap-2.5">
          {data.map((g) => (
            <li key={g.address}>
              <Fade>
                <GroupRow group={g} me={me} />
              </Fade>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[12px] text-ink-faint">
        Joining someone else&rsquo;s circle? Open the{" "}
        <span className="addr">/g/…</span> invite link they sent you.
      </p>
    </div>
  );
}

type Todo = { address: string; circle: string; text: string };

/** What (if anything) this circle needs from the viewer right now. */
function actionFor(
  group: GroupAccount,
  cycle: CycleAccount | null,
  me: string,
  now: number,
): Todo | null {
  const d = group.data;
  const circle = decodeName(d.name) || "Untitled circle";
  const idx = d.members.slice(0, d.memberCount).indexOf(me as never);

  if (d.status === 0) {
    if (idx === 0 && d.memberCount < d.capacity)
      return { address: group.address, circle, text: "share the invite link" };
    return null;
  }
  if (d.status !== 1 || !cycle) return null;

  const funded = cycle.data.contributorCount === d.memberCount;
  const pastDeadline = now > Number(cycle.data.deadline);
  const crankable = !cycle.data.disbursed && (funded || pastDeadline);
  const iPaid = idx >= 0 && (cycle.data.contributed & (1 << idx)) !== 0;

  if (crankable)
    return {
      address: group.address,
      circle,
      text: funded ? "round is funded — send the payout" : "deadline passed — crank it",
    };
  if (idx >= 0 && !iPaid)
    return {
      address: group.address,
      circle,
      text: `contribute ${formatUsdc(d.contribution)} USDC`,
    };
  return null;
}

function AggregateBar({ groups, me }: { groups: GroupAccount[]; me: string }) {
  let perRound = 0n;
  let collect = 0n;
  let next: { name: string; round: number; now: boolean } | null = null;

  for (const g of groups) {
    const d = g.data;
    const idx = d.members.slice(0, d.memberCount).indexOf(me as never);
    if (idx < 0) continue;
    if (d.status === 1) perRound += d.contribution;
    collect += d.contribution * BigInt(d.memberCount);
    const pos = rotationPosition(d.rotation, idx, d.memberCount);
    if (d.status === 1 && pos != null) {
      const isNow = pos - 1 === d.currentCycle;
      const upcoming = pos - 1 > d.currentCycle;
      if (isNow && (!next || !next.now)) {
        next = { name: decodeName(d.name), round: pos, now: true };
      } else if (upcoming && !next) {
        next = { name: decodeName(d.name), round: pos, now: false };
      }
    }
  }

  const cells = [
    { label: "Circles", value: `${groups.length}` },
    { label: "Per round", value: formatUsdc(perRound, { fixed: true }), sub: "USDC" },
    { label: "You collect", value: formatUsdc(collect, { fixed: true }), sub: "USDC total" },
    {
      label: "Next turn",
      value: next ? (next.now ? "Now" : `Round ${next.round}`) : "—",
      sub: next?.name,
      accent: next?.now,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col gap-1.5 bg-surface p-4">
          <span className="micro">{c.label}</span>
          <span
            className={`tnum text-[19px] leading-none ${
              c.accent ? "text-accent" : "text-ink"
            }`}
          >
            {c.value}
          </span>
          {c.sub ? (
            <span className="truncate text-[11px] text-ink-muted">{c.sub}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GroupRow({ group, me }: { group: GroupAccount; me: string }) {
  const d = group.data;
  const members = d.members.slice(0, d.memberCount) as Address[];
  const myIndex = members.indexOf(me as never);
  const myPosition =
    d.status === 0
      ? null
      : rotationPosition(d.rotation, myIndex, d.memberCount);
  const myTurnNow = myPosition != null && myPosition - 1 === d.currentCycle;

  return (
    <Link
      href={`/g/${group.address}`}
      className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:bg-raised"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-serif text-[17px] text-ink">
            {decodeName(d.name) || "Untitled circle"}
          </span>
          <span className="shrink-0 rounded-pill border border-line px-1.5 py-0.5 text-[11px] text-ink-muted">
            {STATUS_LABEL[d.status]}
          </span>
        </div>
        <p className="tnum mt-1 text-[12px] text-ink-muted">
          {formatUsdc(d.contribution)} USDC · {d.memberCount}/{d.capacity} seats
          {d.status === 1
            ? ` · round ${d.currentCycle + 1} of ${d.memberCount}`
            : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden -space-x-1 sm:flex">
          {members.slice(0, 4).map((m) => (
            <span key={m} className="rounded-full bg-surface p-0.5">
              <MemberMark address={m} size={16} />
            </span>
          ))}
          {d.memberCount > 4 ? (
            <span className="tnum pl-1.5 text-[11px] text-ink-faint">
              +{d.memberCount - 4}
            </span>
          ) : null}
        </div>
        <span
          className={`w-[92px] text-right text-[12px] ${
            myTurnNow ? "font-medium text-accent" : "text-ink-muted"
          }`}
        >
          {myPosition
            ? myTurnNow
              ? "your turn now"
              : `you collect R${myPosition}`
            : d.status === 0
              ? "seats open"
              : ""}
        </span>
      </div>
    </Link>
  );
}

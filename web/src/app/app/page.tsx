"use client";

import Link from "next/link";

import type { Address } from "@solana/kit";

import { MemberMark } from "@/components/member-identity";
import { Button, Card, Fade } from "@/components/ui";
import { ConnectGate, Shell } from "@/components/shell";
import { RequirePrivy } from "@/components/require-privy";
import { decodeName, formatUsdc, rotationPosition } from "@/lib/savora/format";
import { useMyGroups } from "@/lib/savora/hooks";
import { useConnection } from "@/lib/savora/use-savora";
import type { GroupAccount } from "@/lib/savora/queries";

const STATUS_LABEL = ["Forming", "Active", "Completed"] as const;

export default function AppPage() {
  return (
    <Shell width="max-w-reading">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[34px] leading-none text-ink">
          Your circles
        </h1>
        <Link href="/app/new">
          <Button variant="secondary">New circle</Button>
        </Link>
      </div>
      <div className="mt-8">
        <RequirePrivy>
          <MyCircles />
        </RequirePrivy>
      </div>
    </Shell>
  );
}

function MyCircles() {
  const { authenticated, ready, address } = useConnection();
  const groups = useMyGroups(address);

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;
  if (groups.isLoading)
    return <p className="text-[13px] text-ink-muted">Loading…</p>;

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

  return (
    <div className="flex flex-col gap-6">
      <AggregateBar groups={data} me={address!} />
      <ul className="flex flex-col gap-2.5">
        {data.map((g) => (
          <li key={g.address}>
            <Fade>
              <GroupRow group={g} me={address!} />
            </Fade>
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-faint">
        Joining someone else&rsquo;s circle? Open the{" "}
        <span className="addr">/g/…</span> invite link they sent you.
      </p>
    </div>
  );
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
      const now = pos - 1 === d.currentCycle;
      const upcoming = pos - 1 > d.currentCycle;
      if (now && (!next || !next.now)) {
        next = { name: decodeName(d.name), round: pos, now: true };
      } else if (upcoming && !next) {
        next = { name: decodeName(d.name), round: pos, now: false };
      }
    }
  }

  const cells = [
    { label: "Circles", value: `${groups.length}` },
    { label: "Per round", value: `${formatUsdc(perRound, { fixed: true })}`, sub: "USDC" },
    { label: "You collect", value: `${formatUsdc(collect, { fixed: true })}`, sub: "USDC total" },
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
            <span
              key={m}
              className="rounded-full bg-surface p-0.5"
            >
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

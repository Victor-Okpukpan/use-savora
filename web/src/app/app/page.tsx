"use client";

import Link from "next/link";

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
    <Shell>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[30px] leading-tight text-ink">
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

  return (
    <>
      {!ready ? null : !authenticated ? (
        <ConnectGate />
      ) : groups.isLoading ? (
        <p className="text-[13px] text-ink-muted">Loading…</p>
      ) : groups.data && groups.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {groups.data.map((g) => (
            <li key={g.address}>
              <Fade>
                <GroupRow group={g} me={address!} />
              </Fade>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="text-[15px] font-medium text-ink">No circles yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-[1.6] text-ink-muted">
            Start one and share the link, or paste an invite link a friend sent
            you into your browser to join theirs.
          </p>
          <div className="mt-5 flex justify-center">
            <Link href="/app/new">
              <Button>Start a circle</Button>
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}

function GroupRow({ group, me }: { group: GroupAccount; me: string }) {
  const d = group.data;
  const myIndex = d.members.slice(0, d.memberCount).indexOf(me as never);
  const myPosition =
    d.status === 0
      ? null
      : rotationPosition(d.rotation, myIndex, d.memberCount);

  return (
    <Link
      href={`/g/${group.address}`}
      className="flex items-center justify-between rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:bg-surface-sunk"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">
            {decodeName(d.name) || "Untitled circle"}
          </span>
          <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-ink-muted">
            {STATUS_LABEL[d.status]}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-ink-muted tnum">
          {formatUsdc(d.contribution)} USDC · {d.memberCount}/{d.capacity} seats
          {d.status === 1
            ? ` · round ${d.currentCycle + 1} of ${d.memberCount}`
            : ""}
        </p>
      </div>
      <div className="shrink-0 pl-4 text-right">
        {myPosition ? (
          <span className="tnum text-[12px] text-ink-muted">
            you collect {ordinal(myPosition)}
          </span>
        ) : d.status === 0 ? (
          <span className="text-[12px] text-ink-faint">seats open</span>
        ) : null}
      </div>
    </Link>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

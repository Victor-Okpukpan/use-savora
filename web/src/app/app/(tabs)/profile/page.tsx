"use client";

import { useState } from "react";

import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";
import Link from "next/link";

import { MemberMark } from "@/components/member-identity";
import { ConnectGate } from "@/components/shell";
import { Card } from "@/components/ui";
import { DevnetFunds } from "@/components/devnet-faucet";
import { DEMO } from "@/lib/savora/demo";
import { useBalances } from "@/lib/savora/balances";
import { decodeName, formatUsdc, rotationPosition } from "@/lib/savora/format";
import {
  getMyName,
  setMyName,
  useMyName,
} from "@/lib/savora/identity";
import { useMyGroups } from "@/lib/savora/hooks";
import { computeRecord } from "@/lib/savora/position";
import { useConnection } from "@/lib/savora/use-savora";
import type { GroupAccount } from "@/lib/savora/queries";

const SOL = 1_000_000_000;
const STATUS_LABEL = ["Forming", "Active", "Completed"] as const;

export default function ProfileTab() {
  const { authenticated, ready, address } = useConnection();
  const { user } = usePrivy();
  const groups = useMyGroups(address);

  if (!ready) return null;
  if (!authenticated || !address) return <ConnectGate />;

  const data = groups.data ?? [];
  const record = computeRecord(data, address);

  return (
    <div className="flex flex-col gap-8">
      <Identity address={address} signIn={describeSignIn(user)} />
      <ReliabilityRecord record={record} />
      <WalletFunds address={address} />
      <History groups={data} me={address} loading={groups.isLoading} />
    </div>
  );
}

/* ---------------- Identity ---------------- */

function Identity({
  address,
  signIn,
}: {
  address: string;
  signIn: string;
}) {
  const name = useMyName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <section>
      <h2 className="micro mb-3">Identity</h2>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <MemberMark address={address} size={40} />
          <div className="min-w-0">
            {editing ? (
              <input
                autoFocus
                value={draft}
                maxLength={24}
                placeholder="display name"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  setMyName(draft);
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setMyName(draft);
                    setEditing(false);
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                className="h-7 w-40 rounded-md border border-line bg-surface px-2 text-[15px] outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setDraft(getMyName() ?? "");
                  setEditing(true);
                }}
                className="text-[16px] font-medium text-ink hover:text-accent"
                title="Set a display name (saved on this device)"
              >
                {name ?? "Set a display name"}
              </button>
            )}
            <p className="mt-0.5 text-[12px] text-ink-muted">
              signed in with {signIn}
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center justify-between rounded-control border border-line bg-surface-sunk px-3 py-2 text-left"
        >
          <span className="addr truncate text-[12px] text-ink-muted">
            {address}
          </span>
          <span className="ml-3 shrink-0 text-[11px] font-medium text-accent">
            {copied ? "Copied" : "Copy"}
          </span>
        </button>

        <p className="text-[11px] leading-[1.6] text-ink-faint">
          Your display name is stored in this browser only. Other members see
          your address unless they set a nickname for you themselves.
        </p>
      </Card>
    </section>
  );
}

function describeSignIn(user: ReturnType<typeof usePrivy>["user"]): string {
  if (DEMO) return "demo mode";
  if (!user) return "your account";
  if (user.email?.address) return `email · ${user.email.address}`;
  if (user.google?.email) return `Google · ${user.google.email}`;
  const w = user.wallet;
  if (w) return w.walletClientType === "privy" ? "an embedded wallet" : "an external wallet";
  return "your account";
}

/* ---------------- Reliability record ---------------- */

function ReliabilityRecord({
  record,
}: {
  record: ReturnType<typeof computeRecord>;
}) {
  const cells = [
    {
      label: "Rounds paid",
      value: `${record.roundsPaid}`,
      sub:
        record.roundsMissed > 0
          ? `${record.roundsMissed} missed`
          : "none missed",
      accent: record.roundsMissed === 0 && record.roundsPaid > 0,
    },
    { label: "Turns taken", value: `${record.turnsTaken}` },
    {
      label: "Contributed",
      value: formatUsdc(record.contributed, { fixed: true }),
      sub: "USDC, exact",
    },
    {
      label: "Circles",
      value: `${record.circlesActive + record.circlesCompleted}`,
      sub:
        record.circlesCompleted > 0
          ? `${record.circlesCompleted} completed`
          : `${record.circlesActive} active`,
    },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="micro">Reliability record</h2>
        <span className="text-[10px] text-ink-faint">verifiable on-chain</span>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-1.5 bg-surface p-4">
            <span className="micro">{c.label}</span>
            <span
              className={`tnum text-[20px] leading-none ${
                c.accent ? "text-positive" : "text-ink"
              }`}
            >
              {c.value}
            </span>
            {c.sub ? (
              <span className="text-[11px] text-ink-muted">{c.sub}</span>
            ) : null}
          </div>
        ))}
      </div>
      {record.blemishes.length > 0 ? (
        <p className="mt-3 text-[12px] text-ink-muted">
          Missed rounds in{" "}
          {record.blemishes
            .map((b) => `${b.name} (${b.missed}×)`)
            .join(", ")}
          .
        </p>
      ) : null}
      <p className="mt-3 max-w-[56ch] text-[11px] leading-[1.6] text-ink-faint">
        Every figure here is derived from the on-chain <code>Group.missed</code>{" "}
        counter and disbursed-cycle count — no database, and anyone can check it.
        Amounts collected are shown as turns rather than USDC, since a payout can
        be short when others miss.
      </p>
    </section>
  );
}

/* ---------------- Wallet & funds ---------------- */

function WalletFunds({ address }: { address: string }) {
  const balances = useBalances(address as never);
  const { exportWallet } = useExportWallet();

  const sol = balances.data ? balances.data.sol : null;
  const usdc = balances.data ? balances.data.usdc : null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="micro">Wallet &amp; funds</h2>
        <span className="text-[10px] text-ink-faint">devnet</span>
      </div>
      <Card className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="micro">SOL</span>
            <span className="tnum text-[20px] leading-none text-ink">
              {sol == null
                ? "—"
                : (Number(sol) / SOL).toLocaleString("en-US", {
                    maximumFractionDigits: 4,
                  })}
            </span>
            <span className="text-[11px] text-ink-muted">for fees</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="micro">USDC</span>
            <span className="tnum text-[20px] leading-none text-ink">
              {usdc == null ? "0.00" : formatUsdc(usdc, { fixed: true })}
            </span>
            <span className="text-[11px] text-ink-muted">to contribute</span>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <DevnetFunds address={address as never} />
        </div>

        {!DEMO ? (
          <button
            onClick={() => exportWallet({ address })}
            className="self-start text-[12px] text-accent underline-offset-2 hover:underline"
          >
            Export this wallet ↗
          </button>
        ) : null}
      </Card>
    </section>
  );
}

/* ---------------- Circle history ---------------- */

function History({
  groups,
  me,
  loading,
}: {
  groups: GroupAccount[];
  me: string;
  loading: boolean;
}) {
  if (loading)
    return (
      <section>
        <h2 className="micro mb-3">Circle history</h2>
        <p className="text-[13px] text-ink-muted">Loading…</p>
      </section>
    );

  if (groups.length === 0)
    return (
      <section>
        <h2 className="micro mb-3">Circle history</h2>
        <p className="text-[13px] text-ink-muted">
          You haven&rsquo;t joined any circles yet.
        </p>
      </section>
    );

  return (
    <section>
      <h2 className="micro mb-3">Circle history</h2>
      <div className="overflow-hidden rounded-card border border-line">
        {groups.map((g) => {
          const d = g.data;
          const idx = d.members.slice(0, d.memberCount).indexOf(me as never);
          const paid = Math.max(0, d.currentCycle - (d.missed[idx] ?? 0));
          const pos = rotationPosition(d.rotation, idx, d.memberCount);
          return (
            <Link
              key={g.address}
              href={`/g/${g.address}`}
              className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-[13px] transition-colors last:border-0 hover:bg-raised"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-serif text-[15px] text-ink">
                  {decodeName(d.name) || "Untitled circle"}
                </span>
                <span className="shrink-0 rounded-pill border border-line px-1.5 py-0.5 text-[10px] text-ink-muted">
                  {STATUS_LABEL[d.status]}
                </span>
              </span>
              <span className="tnum shrink-0 text-[12px] text-ink-muted">
                {pos ? `R${pos}` : "—"} ·{" "}
                {formatUsdc(d.contribution * BigInt(paid), { fixed: true })} in
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

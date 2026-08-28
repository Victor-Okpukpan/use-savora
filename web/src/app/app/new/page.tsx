"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Field, PendingBar, input } from "@/components/ui";
import { ConnectGate, Shell } from "@/components/shell";
import { RequirePrivy } from "@/components/require-privy";
import { fetchMaybeGroup } from "@/generated";
import { MIN_CYCLE_SECS } from "@/lib/savora/config";
import { formatUsdc, parseUsdc } from "@/lib/savora/format";
import { findGroupPda } from "@/lib/savora/pdas";
import { rpc } from "@/lib/savora/rpc";
import { useConnection, useSavora } from "@/lib/savora/use-savora";

const CYCLE_PRESETS = [
  { label: "1 minute", secs: 60, note: "testing" },
  { label: "1 hour", secs: 3600, note: "testing" },
  { label: "1 week", secs: 604_800 },
  { label: "2 weeks", secs: 1_209_600 },
  { label: "1 month", secs: 2_592_000 },
];

const GRACE_PRESETS = [
  { label: "1 minute", secs: 60, note: "testing" },
  { label: "1 hour", secs: 3600 },
  { label: "12 hours", secs: 43_200 },
  { label: "24 hours", secs: 86_400 },
  { label: "3 days", secs: 259_200 },
];

function genSeed(): bigint {
  return BigInt(
    `0x${crypto
      .getRandomValues(new Uint8Array(8))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`,
  );
}

export default function NewCirclePage() {
  return (
    <Shell>
      <h1 className="font-serif text-[34px] leading-none text-ink">
        Start a circle
      </h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        You&rsquo;ll be the first member and lock a security deposit. Share the
        invite link once it&rsquo;s created — the circle seals and starts as soon
        as every seat is filled.
      </p>
      <div className="mt-8">
        <RequirePrivy>
          <NewCircleForm />
        </RequirePrivy>
      </div>
    </Shell>
  );
}

function NewCircleForm() {
  const router = useRouter();
  const { authenticated, ready } = useConnection();
  const savora = useSavora();

  // One seed for the lifetime of this form — a retry must not mint a 2nd circle.
  const [seed] = useState(genSeed);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("50");
  const [depositInput, setDepositInput] = useState("50");
  const [depositTouched, setDepositTouched] = useState(false);
  const [seats, setSeats] = useState(5);
  const [rotations, setRotations] = useState(1);
  const [cycleSecs, setCycleSecs] = useState(604_800);
  const [graceSecs, setGraceSecs] = useState(86_400);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { value: parseUsdc(amount || "0"), error: null as string | null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [amount]);

  // Deposit tracks the contribution until the creator edits it directly.
  const depositStr = depositTouched ? depositInput : amount;
  const parsedDeposit = useMemo(() => {
    try {
      return { value: parseUsdc(depositStr || "0"), error: null as string | null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [depositStr]);

  const nameBytes = new TextEncoder().encode(name).length;
  const perRotation =
    parsed.value != null ? parsed.value * BigInt(seats - 1) : null;
  const upfront =
    parsed.value != null && parsedDeposit.value != null
      ? parsedDeposit.value + parsed.value
      : null;

  const depositValid =
    parsedDeposit.value != null &&
    parsed.value != null &&
    parsedDeposit.value >= parsed.value;

  const canSubmit =
    authenticated &&
    !busy &&
    name.trim().length > 0 &&
    nameBytes <= 32 &&
    parsed.value != null &&
    parsed.value > 0n &&
    depositValid &&
    seats >= 2 &&
    seats <= 12 &&
    rotations >= 1 &&
    rotations <= 24 &&
    cycleSecs >= MIN_CYCLE_SECS;

  async function submit() {
    if (!canSubmit || parsed.value == null || parsedDeposit.value == null || !savora.address)
      return;
    setBusy(true);
    setError(null);
    const [group] = await findGroupPda(savora.address, seed);
    try {
      await savora.createGroup({
        seed,
        name: name.trim(),
        contribution: parsed.value,
        deposit: parsedDeposit.value,
        cycleSecs: BigInt(cycleSecs),
        graceSecs: BigInt(graceSecs),
        capacity: seats,
        rotations,
      });
      router.push(`/g/${group}`);
    } catch (e) {
      // The transaction may have landed even though the wallet reported an
      // error (a confirmation timeout, a closed modal). If the circle exists,
      // go to it rather than showing a failure.
      try {
        const acc = await fetchMaybeGroup(rpc, group);
        if (acc.exists) {
          router.push(`/g/${group}`);
          return;
        }
      } catch {
        /* fall through to the error */
      }
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5">
        <Field label="Circle name" hint={`${nameBytes}/32 characters`}>
          <input
            className={input}
            value={name}
            maxLength={40}
            placeholder="Ìyá's Circle"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field
          label="Contribution per round (USDC)"
          hint={parsed.error ?? "What each member puts in every round"}
        >
          <input
            className={input}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field
          label="Security deposit (USDC)"
          hint={
            !depositValid && parsedDeposit.value != null
              ? "Must be at least one contribution"
              : "Locked at join, refunded on a clean exit. Forfeited if a member misses a round."
          }
        >
          <input
            className={input}
            inputMode="decimal"
            value={depositStr}
            onChange={(e) => {
              setDepositTouched(true);
              setDepositInput(e.target.value);
            }}
          />
        </Field>

        <Field label="Seats" hint="Between 2 and 12 members">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                onClick={() => setSeats(n)}
                className={`tnum h-9 w-9 rounded-control border text-[13px] transition-colors ${
                  seats === n
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-line bg-surface text-ink-muted hover:bg-surface-sunk"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Rotations"
          hint="How many full passes before the circle completes. Members can agree to more later."
        >
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 6, 12].map((n) => (
              <button
                key={n}
                onClick={() => setRotations(n)}
                className={`tnum h-9 w-9 rounded-control border text-[13px] transition-colors ${
                  rotations === n
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-line bg-surface text-ink-muted hover:bg-surface-sunk"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Round length">
          <div className="flex flex-wrap gap-1.5">
            {CYCLE_PRESETS.map((p) => (
              <PresetButton
                key={p.secs}
                active={cycleSecs === p.secs}
                onClick={() => setCycleSecs(p.secs)}
                label={p.label}
                note={p.note}
              />
            ))}
          </div>
        </Field>

        <Field
          label="Grace period"
          hint="After the deadline, how long stragglers still have to pay before they're ejected."
        >
          <div className="flex flex-wrap gap-1.5">
            {GRACE_PRESETS.map((p) => (
              <PresetButton
                key={p.secs}
                active={graceSecs === p.secs}
                onClick={() => setGraceSecs(p.secs)}
                label={p.label}
                note={p.note}
              />
            ))}
          </div>
        </Field>

        <div className="flex flex-col gap-2 border-t border-line pt-4 text-[13px]">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-muted">Due from you now (deposit + round 1)</span>
            <span className="tnum text-[18px] text-ink">
              {upfront != null ? `${formatUsdc(upfront)} USDC` : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-ink-faint">
            <span>You collect each turn (nominal)</span>
            <span className="tnum">
              {perRotation != null ? `${formatUsdc(perRotation)} USDC` : "—"}
            </span>
          </div>
        </div>

        {error ? <p className="text-[12px] text-danger">{error}</p> : null}

        <div className="flex flex-col gap-3">
          <PendingBar active={busy} />
          <Button size="lg" loading={busy} disabled={!canSubmit} onClick={submit}>
            Create circle
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PresetButton({
  active,
  onClick,
  label,
  note,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  note?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-control border px-3 text-[13px] transition-colors ${
        active
          ? "border-accent bg-accent text-accent-contrast"
          : "border-line bg-surface text-ink-muted hover:bg-surface-sunk"
      }`}
    >
      {label}
      {note ? (
        <span className="ml-1.5 text-[11px] opacity-70">{note}</span>
      ) : null}
    </button>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, Field, PendingBar, input } from "@/components/ui";
import { ConnectGate, Shell } from "@/components/shell";
import { RequirePrivy } from "@/components/require-privy";
import { MIN_CYCLE_SECS } from "@/lib/savora/config";
import { formatUsdc, parseUsdc } from "@/lib/savora/format";
import { findGroupPda } from "@/lib/savora/pdas";
import { useConnection, useSavora } from "@/lib/savora/use-savora";

const CYCLE_PRESETS = [
  { label: "1 minute", secs: 60, note: "devnet testing" },
  { label: "1 hour", secs: 3600, note: "devnet testing" },
  { label: "1 week", secs: 604_800 },
  { label: "2 weeks", secs: 1_209_600 },
  { label: "1 month", secs: 2_592_000 },
];

export default function NewCirclePage() {
  return (
    <Shell>
      <h1 className="font-serif text-[30px] leading-tight text-ink">
        Start a circle
      </h1>
      <p className="mt-2 text-[13px] text-ink-muted">
        You&rsquo;ll be the first member. Share the invite link once it&rsquo;s
        created — the circle seals and starts as soon as every seat is filled.
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

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("50");
  const [seats, setSeats] = useState(5);
  const [cycleSecs, setCycleSecs] = useState(604_800);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    try {
      return { value: parseUsdc(amount || "0"), error: null as string | null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [amount]);

  const nameBytes = new TextEncoder().encode(name).length;
  const total =
    parsed.value != null ? parsed.value * BigInt(seats) : null;

  const canSubmit =
    authenticated &&
    !busy &&
    name.trim().length > 0 &&
    nameBytes <= 32 &&
    parsed.value != null &&
    parsed.value > 0n &&
    seats >= 2 &&
    seats <= 12 &&
    cycleSecs >= MIN_CYCLE_SECS;

  async function submit() {
    if (!canSubmit || parsed.value == null || !savora.address) return;
    setBusy(true);
    setError(null);
    try {
      const seed = BigInt(
        `0x${crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`,
      );
      const [group] = await findGroupPda(savora.address, seed);
      await savora.createGroup({
        seed,
        name: name.trim(),
        contribution: parsed.value,
        cycleSecs: BigInt(cycleSecs),
        capacity: seats,
      });
      router.push(`/g/${group}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!authenticated) return <ConnectGate />;

  return (
    <>
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

            <Field label="Round length">
              <div className="flex flex-wrap gap-1.5">
                {CYCLE_PRESETS.map((p) => (
                  <button
                    key={p.secs}
                    onClick={() => setCycleSecs(p.secs)}
                    className={`h-9 rounded-control border px-3 text-[13px] transition-colors ${
                      cycleSecs === p.secs
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-line bg-surface text-ink-muted hover:bg-surface-sunk"
                    }`}
                  >
                    {p.label}
                    {p.note ? (
                      <span className="ml-1.5 text-[11px] opacity-70">
                        {p.note}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </Field>

            <div className="flex items-baseline justify-between border-t border-line pt-4">
              <span className="text-[13px] text-ink-muted">
                Total each member commits over the full rotation
              </span>
              <span className="tnum text-[18px] text-ink">
                {total != null ? `${formatUsdc(total)} USDC` : "—"}
              </span>
            </div>

            {error ? (
              <p className="text-[12px] text-danger">{error}</p>
            ) : null}

            <div className="flex flex-col gap-3">
              <PendingBar active={busy} />
              <Button size="lg" loading={busy} disabled={!canSubmit} onClick={submit}>
                Create circle
              </Button>
            </div>
          </div>
        </Card>
    </>
  );
}

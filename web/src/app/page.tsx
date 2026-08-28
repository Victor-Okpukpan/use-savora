import Link from "next/link";

import { ConnectButton } from "@/components/connect-button";
import { RotationDiagram } from "@/components/rotation-diagram";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="grid items-center gap-10 border-b border-line py-20 sm:py-28 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Ajo, on-chain
            </p>
            <h1 className="mt-5 max-w-[16ch] font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[52px]">
              Your savings circle, without someone holding the money.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.6] text-ink-muted">
              You already know how ajo works. A group agrees on an amount,
              everyone puts it in each round, and one person collects the whole
              pot — turn by turn, until everyone has had theirs. Savora runs that
              on Solana, so the pool sits in a contract instead of one
              person&rsquo;s account.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ConnectButton />
              <Link
                href="/app"
                className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:bg-surface-sunk"
              >
                Go to your circles
              </Link>
            </div>
          </div>

          <div className="hidden justify-self-center lg:block">
            <RotationDiagram />
          </div>
        </section>

        <section className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-bg p-6">
              <span className="tnum text-[13px] text-ink-faint">{step.n}</span>
              <h3 className="mt-2 text-[15px] font-medium text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-ink-muted">
                {step.body}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-10 py-16 sm:grid-cols-2">
          <div>
            <h2 className="text-[15px] font-medium text-ink">
              Where the money actually sits
            </h2>
            <p className="mt-3 text-[13px] leading-[1.6] text-ink-muted">
              Every contribution goes straight into a program-owned vault. Savora
              has no key that can move it, pause it, or sweep it. The only way
              funds leave is the payout — and the contract decides who receives
              it, by the rotation order fixed when the group filled up.
            </p>
          </div>
          <div>
            <h2 className="text-[15px] font-medium text-ink">
              New to crypto wallets?
            </h2>
            <p className="mt-3 text-[13px] leading-[1.6] text-ink-muted">
              You don&rsquo;t need one installed. Sign in with your email or a
              Google account and a wallet is created for you in the background.
              If you already use Phantom or another Solana wallet, connect that
              instead.
            </p>
          </div>
        </section>

        <section className="border-t border-line py-10">
          <p className="max-w-xl text-[12px] leading-[1.7] text-ink-faint">
            A note on fairness: the payout order is shuffled on-chain when the
            group seals, seeded from a recent block hash, so no one — not even
            the person who started the group — chooses who collects first. The
            one caveat is that a Solana block producer who controls the exact
            sealing moment could nudge that seed. For a circle of people who know
            each other, we think that&rsquo;s an acceptable trade; we&rsquo;d
            rather say it plainly than hide it.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-[12px] text-ink-faint">
          <span>Savora · non-custodial · Solana devnet</span>
          <span className="tnum">USDC only</span>
        </div>
      </footer>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Start a circle, share the link",
    body: "Set the amount, the number of seats, and how long each round runs. Send the link to your group. It seals itself once every seat is taken.",
  },
  {
    n: "02",
    title: "Everyone contributes each round",
    body: "The fixed amount in USDC, per person, per round. Late is fine as long as it lands before the round is paid out.",
  },
  {
    n: "03",
    title: "One person collects, then it rotates",
    body: "Once the round is funded, anyone can trigger the payout. The contract sends it to whoever's turn it is — no one can redirect it.",
  },
];

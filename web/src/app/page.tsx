import Link from "next/link";

import { ConnectButton } from "@/components/connect-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  FigRotation,
  FigShuffle,
  FigVault,
  Figure,
} from "@/components/marketing/figures";
import {
  LineReveal,
  Parallax,
  Reveal,
  RevealGroup,
  RevealItem,
} from "@/components/marketing/motion";
import { ProductMock } from "@/components/marketing/product-mock";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="mx-auto w-full max-w-site px-6 pt-20 sm:px-8 sm:pt-28 lg:px-12">
          <Reveal>
            <p className="micro">Ajo, on-chain</p>
          </Reveal>

          <LineReveal
            className="display-1 mt-6 text-ink"
            lines={["Your savings circle,", "without someone", "holding the money."]}
          />

          <Reveal delay={0.15}>
            <p className="mt-8 max-w-[46ch] text-[16px] leading-[1.6] text-ink-muted">
              You already know how ajo works. A group agrees on an amount,
              everyone puts it in each round, and one person collects the whole
              pot — turn by turn, until everyone has had theirs. Savora runs that
              on Solana, so the pool sits in a contract instead of one
              person&rsquo;s account.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ConnectButton shape="pill" size="lg" label="Start a circle" />
              <Link
                href="/docs"
                className="inline-flex h-11 items-center rounded-pill border border-line-strong px-5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-sunk"
              >
                How it works
              </Link>
            </div>
          </Reveal>
        </section>

        {/* product mock, cropped by the fold */}
        <div className="mx-auto mt-16 w-full max-w-site px-6 sm:mt-24 sm:px-8 lg:px-12">
          <Reveal>
            <Parallax
              range={28}
              className="relative mx-auto max-h-[540px] max-w-mock overflow-hidden sm:max-h-[640px]"
            >
              <ProductMock />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-bg to-transparent" />
            </Parallax>
          </Reveal>
        </div>

        {/* ---- Stack strip ---- */}
        <section className="border-t border-line bg-raised">
          <div className="mx-auto w-full max-w-site px-6 py-14 sm:px-8 lg:px-12">
            <Reveal>
              <p className="micro">The stack under your circle</p>
            </Reveal>
            <RevealGroup className="mt-6 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
              {STACK.map((s) => (
                <RevealItem key={s.name}>
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-medium text-ink">
                      {s.name}
                    </span>
                    <span className="text-[12px] text-ink-muted">{s.role}</span>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ---- Figure band ---- */}
        <section className="mx-auto w-full max-w-site px-6 py-8 sm:px-8 lg:px-12">
          <div className="grid divide-y divide-line border-y border-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <Figure
              n="0.1"
              title="Nobody holds the money"
              caption="Every contribution goes into a program-owned vault. Savora has no key that can move it, pause it, or sweep it."
            >
              <FigVault />
            </Figure>
            <Figure
              n="0.2"
              title="The order is fixed at seal"
              caption="When the last seat fills, the collection order is shuffled on-chain from a recent block hash. No one picks it — not even the person who started the circle."
            >
              <FigShuffle />
            </Figure>
            <Figure
              n="0.3"
              title="It never stalls"
              caption="Once a round is funded, or once its deadline passes, anyone can trigger the payout. The contract sends it to whoever's turn it is."
            >
              <FigRotation />
            </Figure>
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section className="mx-auto w-full max-w-site px-6 py-20 sm:px-8 lg:px-12">
          <Reveal>
            <h2 className="display-3 max-w-[20ch] text-ink">
              Three steps, then it runs itself.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            <RevealGroup className="grid divide-y divide-line border-y border-line">
              {STEPS.map((step) => (
                <RevealItem key={step.n}>
                  <div className="flex gap-6 py-8">
                    <span className="micro pt-1">{step.n}</span>
                    <div>
                      <h3 className="text-[16px] font-medium text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-2 max-w-[42ch] text-[14px] leading-[1.6] text-ink-muted">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>

            <Reveal>
              <div className="relative max-h-[560px] overflow-hidden rounded-panel">
                <ProductMock variant="contribute" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-bg to-transparent" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- What Savora cannot do ---- */}
        <section className="border-t border-line bg-raised">
          <div className="mx-auto w-full max-w-site px-6 py-20 sm:px-8 lg:px-12">
            <Reveal>
              <h2 className="display-3 max-w-[18ch] text-ink">
                What Savora cannot do.
              </h2>
            </Reveal>
            <RevealGroup className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {CANNOT.map((c) => (
                <RevealItem key={c.title}>
                  <div className="h-full bg-surface p-6">
                    <h3 className="text-[14px] font-medium text-ink">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-[1.6] text-ink-muted">
                      {c.body}
                    </p>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
            <Reveal delay={0.1}>
              <p className="mt-10 max-w-[60ch] text-[13px] leading-[1.7] text-ink-faint">
                One caveat, stated plainly: the seal-time shuffle is seeded from a
                recent block hash, and a Solana block producer who controls the
                exact sealing moment could nudge that seed. For a circle of people
                who know each other, we think that&rsquo;s an acceptable trade —
                and we&rsquo;d rather say it than hide it.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---- Closing CTA (inverted band) ---- */}
        <section data-surface="dark" className="bg-bg">
          <div className="mx-auto w-full max-w-site px-6 py-28 text-center sm:px-8">
            <Reveal>
              <h2 className="display-2 mx-auto max-w-[16ch] text-ink">
                A circle you can actually trust.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-6 max-w-[44ch] text-[15px] leading-[1.6] text-ink-muted">
                Email sign-in, a wallet made for you in the background, and USDC
                that no organiser can touch.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <ConnectButton shape="pill" size="lg" label="Start a circle" />
                <Link
                  href="/app"
                  className="inline-flex h-11 items-center rounded-pill border border-line-strong px-5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-sunk"
                >
                  Go to your circles
                </Link>
              </div>
            </Reveal>
          </div>
          <SiteFooter />
        </section>
      </main>
    </div>
  );
}

const STACK = [
  { name: "Solana", role: "settlement layer" },
  { name: "USDC", role: "by Circle" },
  { name: "Privy", role: "email & wallet sign-in" },
  { name: "Anchor", role: "the vault program" },
];

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

const CANNOT = [
  {
    title: "Take custody",
    body: "The vault is owned by the program. No Savora key can withdraw from it.",
  },
  {
    title: "Pause or freeze",
    body: "There is no admin instruction. The rotation runs to completion.",
  },
  {
    title: "Change the order",
    body: "The shuffle is written once, at seal, and never touched again.",
  },
  {
    title: "Redirect a payout",
    body: "The recipient account is checked against the rotation on every crank.",
  },
];

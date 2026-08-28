import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  IDL_ACCOUNT,
  PROGRAM_DATA,
  PROGRAM_ID,
  UPGRADE_AUTHORITY,
  USDC_MINT,
  explorerUrl,
} from "@/lib/savora/config";
import { DocNav } from "./nav";

const DOCS_DESCRIPTION =
  "How Savora works — in plain language and at the protocol level: the vault, the shuffle, the crank, the guarantees.";

export const metadata: Metadata = {
  title: "Docs",
  description: DOCS_DESCRIPTION,
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Docs · Savora",
    description: DOCS_DESCRIPTION,
    url: "/docs",
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs · Savora",
    description: DOCS_DESCRIPTION,
  },
};

const NAV: { heading: string; id: string; items: [string, string][] }[] = [
  {
    heading: "Using Savora",
    id: "using",
    items: [
      ["ajo-onchain", "Ajo, onchain"],
      ["starting", "Starting a circle"],
      ["joining", "Joining by invite link"],
      ["contributing", "Contributing each round"],
      ["collecting", "Collecting your turn"],
      ["missing", "If someone misses a round"],
      ["wallet", "Getting a wallet & devnet funds"],
    ],
  },
  {
    heading: "Under the hood",
    id: "hood",
    items: [
      ["custody", "Where the money sits"],
      ["shuffle", "The rotation shuffle"],
      ["crank", "The permissionless crank"],
      ["accounts", "Accounts"],
      ["instructions", "Instructions & PDAs"],
      ["cannot", "What Savora cannot do"],
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-14 px-6 py-14 sm:px-8">
        <DocNav sections={NAV} />

        <main className="min-w-0 flex-1">
          <p className="micro">Documentation</p>
          <h1 className="display-3 mt-4 text-ink">
            How Savora works — for members, and for anyone verifying the claim.
          </h1>

          {/* ---------- Using Savora ---------- */}
          <Section id="ajo-onchain" kicker="Using Savora" title="Ajo, onchain">
            <P>
              Ajo (also esusu, adashe, or a rotating savings and credit
              association) is a group that agrees on a fixed amount, contributes
              it every round, and hands the whole pot to one member per round —
              turn by turn, until everyone has collected once.
            </P>
            <P>
              Traditionally an organiser holds the money between rounds. Savora
              removes that role: the pot sits in a program-owned vault on Solana,
              and the program — not a person — decides who receives each payout.
            </P>
          </Section>

          <Section id="starting" title="Starting a circle">
            <P>
              Set four things: the contribution amount in USDC, the number of
              seats (2–12), how long each round runs, and a name. You become the
              first member. The circle is in <B>Forming</B> until every seat is
              taken.
            </P>
          </Section>

          <Section id="joining" title="Joining by invite link">
            <P>
              Every circle has a link — <Code>/g/&lt;address&gt;</Code>. Anyone
              with it can join while seats remain. When the last seat fills, the
              circle <B>seals itself</B> in the same transaction: the collection
              order is shuffled onchain and round&nbsp;1 opens. Before a circle
              seals, any member except the creator can leave.
            </P>
          </Section>

          <Section id="contributing" title="Contributing each round">
            <P>
              Each round you send the fixed amount to the vault. Late is fine —
              a contribution is accepted any time before the round is paid out,
              deadline or not. You cannot contribute twice to the same round.
            </P>
          </Section>

          <Section id="collecting" title="Collecting your turn">
            <P>
              When it is your round, you receive the pool. You do not have to be
              online for it: once the round is fully funded, or once its deadline
              passes, <B>anyone</B> can trigger the payout, and the program sends
              it to whoever the rotation says — it cannot be redirected.
            </P>
          </Section>

          <Section id="missing" title="If someone misses a round">
            <P>
              The rotation never stalls. After the deadline, the payout goes out
              with whatever was actually pooled, and every missed contribution is
              recorded permanently against that member, visible on their row.
              Enforcement is social — the same way ajo has always worked — but
              now it is onchain and impossible to hide.
            </P>
          </Section>

          <Section id="wallet" title="Getting a wallet & devnet funds">
            <P>
              You do not need a wallet installed. Sign in with email or Google
              and one is created for you in the background; if you already use a
              Solana wallet, connect that instead.
            </P>
            <P>
              This deployment runs on Solana <B>devnet</B>. A new wallet has no
              SOL for transaction fees — your profile page has an airdrop button
              — and test USDC comes from{" "}
              <A href="https://faucet.circle.com">Circle&rsquo;s faucet</A>.
            </P>
          </Section>

          {/* ---------- Under the hood ---------- */}
          <Section
            id="custody"
            kicker="Under the hood"
            title="Where the money sits"
          >
            <P>
              The vault is an associated token account whose authority is the{" "}
              <Code>Group</Code> PDA — a program-derived address with no private
              key. Funds can only move via a program instruction, and the only
              instruction that moves them out is the payout, which is constrained
              to the rotation&rsquo;s recipient.
            </P>
            <P>
              There is no admin authority anywhere in the program: no pause, no
              sweep, no upgrade-only withdrawal, no close-to-creator.
            </P>
          </Section>

          <Section id="shuffle" title="The rotation shuffle">
            <P>
              When the last seat fills, the program derives a seed from a recent
              slot hash (the <Code>SlotHashes</Code> sysvar) mixed with the group
              address, expands it with SplitMix64, and runs a Fisher–Yates
              shuffle over the member indices. The result is written to{" "}
              <Code>Group.rotation</Code> once and never touched again.
            </P>
            <P>
              No party chooses the order, and anyone can recompute it from the
              same public inputs to check it. <B>The caveat, stated plainly:</B>{" "}
              a Solana block producer who controls the exact sealing slot can
              bias the slot hash. For a circle of people who know each other we
              accept that trade rather than take on a VRF&rsquo;s complexity —
              but you should know it exists.
            </P>
          </Section>

          <Section id="crank" title="The permissionless crank">
            <P>
              <Code>disburse_payout</Code> can be called by any signer. It
              requires the round to be fully funded, or its deadline passed. The
              recipient is <Code>group.members[cycle.recipient_index]</Code>, and
              the recipient token account passed in is constrained to that owner
              and to the group&rsquo;s mint — so the caller cannot point the
              payout anywhere else. The transfer is signed by the group PDA;
              missed contributors are recorded; the rotation advances.
            </P>
          </Section>

          <Section id="accounts" title="Accounts">
            <Pre>{`Group   PDA ["group", creator, seed: u64]
  creator, seed, mint          pinned at creation
  contribution: u64            per member, per round (USDC base units)
  cycle_secs: i64              round length
  capacity, member_count: u8   seats / filled
  members:  [Pubkey; 12]
  rotation: [u8; 12]           shuffled member indices, written at seal
  missed:   [u16; 12]          permanent per-member miss counter
  status                       Forming | Active | Completed
  current_cycle: u8
  cycle_start: i64

Cycle   PDA ["cycle", group, index: u8]
  recipient_index: u8          = group.rotation[index], fixed at open
  deadline: i64
  pooled: u64
  contributed: u16             bitmask over the 12 member slots
  contributor_count: u8
  disbursed: bool
  payout: u64                  amount actually paid (may be short)

Vault   associated token account, authority = Group PDA`}</Pre>
          </Section>

          <Section id="instructions" title="Instructions & PDAs">
            <Pre>{`create_group(seed, name, contribution, cycle_secs, capacity)
join_group()          seals inline when the last seat fills
leave_group()         Forming only, non-creator
open_cycle()          permissionless; inits the current Cycle account
contribute()          member → vault; sets bitmask bit; late allowed
disburse_payout()     permissionless crank; recipient fixed by rotation`}</Pre>
            <P className="mt-5">
              Program <A href={explorerUrl(PROGRAM_ID)}>{PROGRAM_ID}</A>
              <br />
              Program data{" "}
              <A href={explorerUrl(PROGRAM_DATA)}>{PROGRAM_DATA}</A>
              <br />
              Upgrade authority{" "}
              <A href={explorerUrl(UPGRADE_AUTHORITY)}>{UPGRADE_AUTHORITY}</A>
              <br />
              IDL account <A href={explorerUrl(IDL_ACCOUNT)}>{IDL_ACCOUNT}</A>
              <br />
              Devnet USDC mint{" "}
              <A href={explorerUrl(USDC_MINT)}>{USDC_MINT}</A>
            </P>
            <P className="mt-4 text-[13px] text-ink-faint">
              Deployed to devnet in slot 489374645. The program is upgradeable by
              the authority above; a production release would set it to a
              multisig or burn it.
            </P>
          </Section>

          <Section id="cannot" title="What Savora cannot do">
            <ul className="mt-4 flex flex-col gap-3 text-[14px] leading-[1.6] text-ink-muted">
              {[
                "Take custody — the vault authority is a PDA; no Savora key can sign for it.",
                "Pause or freeze a circle — there is no admin instruction.",
                "Change the collection order — the shuffle is written once, at seal.",
                "Redirect a payout — the recipient account is checked on every crank.",
                "Stop the rotation — after a deadline, anyone can crank it forward.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Section>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-line pt-10 first-of-type:mt-10"
    >
      {kicker ? <p className="micro mb-6 text-accent">{kicker}</p> : null}
      <h2 className="text-[20px] font-medium tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function P({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`max-w-[52ch] text-[14px] leading-[1.7] text-ink-muted ${className}`}>
      {children}
    </p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] bg-surface-sunk px-1 py-0.5 font-mono text-[12px] text-ink">
      {children}
    </code>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="addr text-accent underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-card border border-line bg-surface-sunk p-4 font-mono text-[12px] leading-[1.7] text-ink-muted">
      {children}
    </pre>
  );
}

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
  "How Savora works, in plain language and at the protocol level: the vault, deposits, the shuffle, grace and ejection, the guarantees.";

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
      ["joining", "Joining & the deposit"],
      ["contributing", "Contributing each round"],
      ["collecting", "Collecting your turn"],
      ["missing", "Grace, defaults & ejection"],
      ["extending", "Running it again"],
      ["wallet", "Getting a wallet & devnet funds"],
    ],
  },
  {
    heading: "Under the hood",
    id: "hood",
    items: [
      ["custody", "Where the money sits"],
      ["shuffle", "The rotation shuffle"],
      ["crank", "Auto-payout & the crank"],
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
              Set the contribution amount, the security deposit (at least one
              contribution), the number of seats (2–12), how long each round
              runs, the grace window after each deadline, how many full rotations
              to run, and a name. You become the first member and lock your
              deposit. The circle is in <B>Forming</B> until every seat is taken.
            </P>
          </Section>

          <Section id="joining" title="Joining & the deposit">
            <P>
              Every circle has a link — <Code>/g/&lt;address&gt;</Code>. Anyone
              with it can join while seats remain. Joining locks a{" "}
              <B>security deposit</B> plus your first round&rsquo;s contribution.
              When the last seat fills, the circle goes <B>Active</B>; the first
              <Code>open_cycle</Code> shuffles the order and opens round&nbsp;1.
              Before a circle seals, any member except the creator can leave and
              get their deposit back; the creator can close an empty circle.
            </P>
            <P>
              The deposit is refunded when the circle finishes and you withdraw.
              It is forfeited only if you miss a round. One round&rsquo;s deposit
              covers exactly one missed round — it does <B>not</B> cover the loan
              a member walks away with if they stop paying after collecting, so a
              circle that wants more assurance can set a larger deposit.
            </P>
          </Section>

          <Section id="contributing" title="Contributing each round">
            <P>
              Each round you send the fixed amount to the vault. Late is fine up
              to the deadline <B>plus the grace window</B>; after that the door
              closes and you can no longer pay in. You cannot contribute twice to
              the same round, and the round&rsquo;s recipient owes nothing that
              round.
            </P>
          </Section>

          <Section id="collecting" title="Collecting your turn">
            <P>
              When it is your round, you receive the pool. You do not have to be
              online: the <B>last contribution the round needs pays you out in
              the same transaction</B>. If the round instead reaches its deadline
              short, anyone can trigger the payout with whatever was pooled. The
              program sends it to whoever the rotation says — it cannot be
              redirected.
            </P>
          </Section>

          <Section id="missing" title="Grace, defaults & ejection">
            <P>
              After a round&rsquo;s deadline, a grace window (set per circle)
              gives stragglers time to pay. Once grace closes with money still
              missing, the crank <B>ejects</B> every no-show: their deposit is
              forfeited into the round they missed — so that round&rsquo;s
              recipient is still made whole — and they are removed from the
              rotation, their slot marked permanently. If ejections leave fewer
              than two active members, the circle ends as <B>Failed</B> and the
              rest withdraw their deposits.
            </P>
          </Section>

          <Section id="extending" title="Running it again">
            <P>
              A circle runs the number of rotations set at creation, then goes{" "}
              <B>Completed</B> — but that is not the end. The creator can propose
              more rotations; the extension starts only once <B>every</B> live
              member opts in. Declining withdraws your deposit and ends your
              membership for good. At any completion you can simply withdraw your
              deposit and walk away.
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
              upgrade-only withdrawal, no close-to-creator. The one sweep is{" "}
              <Code>close_group</Code>, and only the creator, only while the
              circle is empty and forming, can call it. A token sent straight to
              the vault after that is stranded — nobody can move it.
            </P>
          </Section>

          <Section id="shuffle" title="The rotation shuffle">
            <P>
              At the start of each rotation, <Code>open_cycle</Code> derives a
              seed from a recent slot hash (the <Code>SlotHashes</Code> sysvar)
              mixed with the group address and salted with the rotation index,
              expands it with SplitMix64, and runs a Fisher–Yates shuffle over
              the live member slots. The result is written to{" "}
              <Code>Group.rotation</Code> and used for that whole rotation.
            </P>
            <P>
              No party chooses the order, and anyone can recompute it from the
              same public inputs. <B>The caveat, stated plainly:</B> whoever
              lands the boundary <Code>open_cycle</Code> transaction chooses the
              slot hash and could grind it — once per rotation, not just at seal.
              For a circle of people who know each other we accept that rather
              than take on a VRF&rsquo;s complexity — but you should know it.
            </P>
          </Section>

          <Section id="crank" title="Auto-payout & the crank">
            <P>
              When the last outstanding contribution lands, <Code>contribute</Code>{" "}
              disburses the payout in the same transaction — no separate step —
              as long as the recipient&rsquo;s token account already exists.
            </P>
            <P>
              Otherwise <Code>disburse_payout</Code>, callable by any signer,
              handles it: once the round is funded, or once the grace window has
              closed. The recipient is{" "}
              <Code>group.members[cycle.recipient_index]</Code> and the recipient
              token account is constrained to that owner and the group&rsquo;s
              mint, so the caller cannot point the payout elsewhere. No-shows are
              ejected and their deposits forfeited into the pool; the transfer is
              signed by the group PDA; the rotation advances.
            </P>
          </Section>

          <Section id="accounts" title="Accounts">
            <Pre>{`Group   PDA ["group", creator, seed: u64]
  creator, seed, mint          pinned at creation
  contribution, deposit: u64   per round / locked at join (deposit >= contribution)
  cycle_secs, grace_secs: i64  round length / post-deadline window
  capacity, seat_count: u8     seats / assigned
  members:  [Pubkey; 12]       slot -> wallet; tombstoned, never compacted
  rotation: [u8; 12]           live slots for the current rotation, reshuffled each pass
  rotation_len, rotation_pos   payouts this rotation / position in it
  rotations_target/_done: u8   agreed rotations (grows on extension) / completed
  ejected, defaulted: u16      bitmasks — out of the circle / ejected for a miss
  optin_mask: u16              extension opt-ins
  status                       Forming | Active | Completed | Extending | Failed
  current_cycle: u16           global, monotonic — the Cycle PDA seed

Cycle   PDA ["cycle", group, index: u16]
  recipient_index: u8          slot that collects; owes nothing this round
  deadline: i64                = opened_at + cycle_secs
  pooled: u64                  contributions + forfeited deposits
  contributed, required: u16   settled / on the hook (live_mask at open)
  ejected_here: u16            slots this crank ejected
  disbursed: bool
  payout: u64

Vault   associated token account, authority = Group PDA
        holds every live deposit + the open round's pool`}</Pre>
          </Section>

          <Section id="instructions" title="Instructions & PDAs">
            <Pre>{`create_group(seed, name, contribution, deposit, cycle_secs, grace_secs, capacity, rotations)
join_group()          locks the deposit; goes Active when the last seat fills
leave_group()         Forming only, non-creator; refunds the deposit
open_cycle()          permissionless; inits the Cycle; reshuffles at a rotation boundary
contribute()          member -> vault; auto-disburses if it completes the round
disburse_payout()     permissionless crank; ejects no-shows past grace
propose_extension()   creator, Completed; propose more rotations
opt_in_extension()    seals the extension once every live member has opted in
cancel_extension()    creator any time, or anyone once the opt-in window closes
close_position()      withdraw the deposit + exit (Completed | Extending | Failed)
close_group()         creator, Forming, seat_count == 1; refunds + closes`}</Pre>
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
              Deployed to devnet. The program is upgradeable by the authority
              above; a production release would set it to a multisig or burn it.
              Only classic SPL Token mints are accepted — a Token-2022 mint with
              a transfer hook or fee would break the vault accounting, so it is
              rejected at creation.
            </P>
          </Section>

          <Section id="cannot" title="What Savora cannot do">
            <ul className="mt-4 flex flex-col gap-3 text-[14px] leading-[1.6] text-ink-muted">
              {[
                "Take custody — the vault authority is a PDA; no Savora key can sign for it.",
                "Pause or freeze a circle — there is no admin instruction.",
                "Change the collection order — the shuffle is fixed for each rotation.",
                "Redirect a payout — the recipient account is checked on every payout.",
                "Touch a live member's deposit — a payout only ever draws the round's pool.",
                "Sweep the vault — except a creator closing their own empty, unfilled circle.",
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

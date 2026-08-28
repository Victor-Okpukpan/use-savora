# Savora

Non-custodial rotating savings (ajo) on Solana.

A fixed group contributes a set amount of USDC each cycle, and one member
collects the whole pool per rotation until everyone has collected once. The
pool lives in a program-owned vault — **there is no admin authority anywhere in
the program**: no pause, no sweep, no way for Savora or the organiser to take
custody.

## Layout

```
programs/savora/      Anchor 0.32 program (Rust)
  src/instructions/   create_group · join_group · leave_group · open_cycle · contribute · disburse_payout
  src/state.rs        Group / Cycle accounts + the seal-time rotation shuffle
tests/                LiteSVM test suite (TypeScript, via vitest)
scripts/codegen.ts    Codama: IDL → typed @solana/kit client
web/                  Next.js 16 app (App Router, Tailwind v4, Privy, motion)
  src/generated/      generated client — do not edit, run `pnpm codegen`
  src/lib/savora/     PDAs, instruction builders, queries, tx sending
  src/app/            /  ·  /app  ·  /app/new  ·  /g/[address]
```

## How it works

| | |
|---|---|
| **Membership** | Open invite link (`/g/<groupPda>`). Anyone joins until the seats fill, then the group seals itself and cycle 1 opens. |
| **Rotation order** | Deterministic Fisher–Yates shuffle at seal, seeded from a recent slot hash mixed with the group PDA. No party chooses it; anyone can recompute it. *Caveat: a block leader controlling the sealing slot can bias the slot hash — acceptable for a circle of people who know each other, and stated plainly in the UI.* |
| **Payout** | Purely permissionless crank (`disburse_payout`). Any signer triggers it once the cycle is funded — or once its deadline passes. The recipient is fixed by rotation order; the recipient token account is constrained to that member and `group.mint`, so the caller cannot redirect funds. |
| **Defaults** | After the deadline the crank pays out whatever was pooled and writes each missed contribution against that member (`Group.missed`). The rotation never stalls; enforcement is social and visible. |

## Develop

```bash
# program
anchor build
pnpm codegen                 # regenerate web/src/generated from the IDL
pnpm test:program            # LiteSVM suite (loads target/deploy/savora.so)

# deploy (devnet)
anchor deploy --provider.cluster devnet
# confirm the program id matches declare_id! and web/src/lib/savora/config.ts

# web
cd web
cp .env.example .env.local   # set NEXT_PUBLIC_PRIVY_APP_ID (dashboard.privy.io)
pnpm dev
```

`NEXT_PUBLIC_SAVORA_DEMO=1 pnpm dev` renders the full UI from fixtures (still
needs a Privy app id, but no wallet funds or live program).

Devnet USDC: mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, faucet at
<https://faucet.circle.com>. Embedded-wallet users start with zero SOL — the
group page has a devnet SOL airdrop button for fees.

## Stack

Anchor 0.32.1 · `@solana/kit` 8 · Codama · LiteSVM · Next.js 16 · React 19 ·
Tailwind v4 · Privy (prebuilt connection UI, themed through config) · motion.

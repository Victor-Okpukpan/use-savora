# Savora

Non-custodial rotating savings (ajo) on Solana.

A fixed group contributes a set amount each cycle, and one member collects the
whole pool per rotation until everyone has collected once — then, if every
member agrees, the circle can run further rotations. The pool lives in a
program-owned vault — **there is no admin authority anywhere in the program**:
no pause, no sweep (bar abandoning an unfilled circle), no way for Savora or
the organiser to take custody or redirect a payout.

## Layout

```
programs/savora/      Anchor 0.32 program (Rust) — 11 instructions
  src/instructions/   create_group · join_group · leave_group · open_cycle · contribute · disburse_payout
                      propose_extension · opt_in_extension · cancel_extension · close_position · close_group
  src/state.rs        Group / Cycle accounts + the rotation shuffle
tests/                LiteSVM test suite (TypeScript, via vitest)
scripts/codegen.ts    Codama: IDL → typed @solana/kit client
web/                  Next.js 16 app (App Router, Tailwind v4, Privy, motion)
  src/generated/      generated client — do not edit, run `pnpm codegen`
  src/lib/savora/     PDAs, instruction builders, queries, tx sending, group.ts helpers
  src/app/            /  ·  /app (Circles · Activity · Profile)  ·  /app/new  ·  /g/[address]  ·  /docs
```

## How it works

| | |
|---|---|
| **Membership** | Open invite link (`/g/<groupPda>`). Anyone joins until the seats fill, then the group seals itself. Joining locks a **security deposit** (`>= contribution`, refunded on a clean exit) plus the first round's contribution. |
| **Rotation order** | Deterministic Fisher–Yates shuffle in `open_cycle` at each rotation boundary, seeded from a recent slot hash mixed with the group PDA and salted with the rotation index. No party chooses it; anyone can recompute it. *Caveat: whoever lands the boundary `open_cycle` chooses the slot hash and can grind it — one instance per rotation now, not just at seal. Acceptable for a circle of people who know each other, and stated plainly in the UI.* |
| **Rounds** | A round is funded when every live member except the recipient has contributed. The **last contribution disburses the payout in the same transaction**; otherwise a permissionless crank sends it. The recipient is pinned to the rotation slot and their token account checked against it, so no caller can redirect funds. |
| **Grace + defaults** | Contributions are accepted until `deadline + grace_secs` (both set per circle). Past that, the crank **ejects** each no-show: their deposit is forfeited into the round they missed (making that recipient whole), and they are dropped from the rotation with their slot tombstoned. Ejection is recorded in `Group.defaulted`. |
| **Extensions** | On a `Completed` circle the creator can `propose_extension`; it seals only when every live member opts in. All-or-nothing: one member declining (via `close_position` — deposit refunded, membership ended) cancels the whole proposal and returns the circle to `Completed`. |
| **Collapse** | If ejections drop a circle below two active members it moves to `Failed`; survivors withdraw their deposits with `close_position`. |

**What the deposit does *not* cover:** a one-round deposit covers exactly one missed round. It does not cover the loan a member walks away with if they default *after* collecting — that exposure is `(n − position) · contribution` and lands on members who have not yet collected. Intrinsic to an under-collateralised ROSCA; the deposit is a create-time parameter so a circle can price its own trust higher, and the roster UI states the exposure per position.

**Stranded value:** anyone can transfer tokens directly to the vault ATA and there is no sweep — consistent with the no-admin promise. Only `close_group` (creator, `Forming`, `seat_count == 1`) reclaims a vault balance.

## Deployment — Solana devnet

| | |
|---|---|
| **Program ID** | `BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2` |
| **ProgramData** | `JAvBqYpG9MoiR6iwYherdHchWDjg7CzMo3indGYCDk5w` |
| **Upgrade authority** | `AL3LxYBsFcShcGq7kuQSA4mN8dSVKyvNQdHsQE9WT7VX` |
| **IDL account** | `GVjyn6Gbn9dTr8AVdJzArD6YGr9e8xzndWcryghfstMD` |
| **Cluster** | devnet |
| **USDC mint** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (Circle devnet, 6 decimals) — faucet at <https://faucet.circle.com> |

> **v2 redeploy pending.** The account layout changed (11 instructions,
> deposits, multi-rotation). Circles created under the old program are not
> readable by the new client and must be recreated after the redeploy below.
> Classic SPL Token mints only — Token-2022 extension mints are rejected.

Explorer: <https://explorer.solana.com/address/BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2?cluster=devnet>

The program ID is hardcoded in `declare_id!` ([`programs/savora/src/lib.rs`](programs/savora/src/lib.rs)) and flows to the frontend through the generated client (`web/src/lib/savora/config.ts` → `SAVORA_PROGRAM_ADDRESS`).

### Redeploying the program

The public devnet RPC rate-limits large uploads; use a dedicated endpoint
(Alchemy / Helius / Triton free tier) as `--provider.cluster` or in
`solana config set --url`.

```bash
# from repo root, with `solana config` already pointed at a dedicated RPC
anchor build

# The v2 binary is ~400 KB (was ~335 KB); an upgrade builds a temporary buffer
# at ~2x that, so the upgrade-authority wallet needs ~3 SOL free during deploy.
solana balance
solana program deploy \
  --program-id target/deploy/savora-keypair.json \
  --with-compute-unit-price 50000 --max-sign-attempts 100 \
  target/deploy/savora.so

# IDL — layout changed, so upgrade it
anchor idl upgrade BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2 \
  --filepath target/idl/savora.json \
  --provider.cluster "$(solana config get | awk '/RPC URL/{print $3}')" \
  --provider.wallet ~/.config/solana/id.json

pnpm codegen   # regenerate the client from the upgraded IDL
```

If a deploy is interrupted it leaves a funded buffer; resume with
`solana program deploy --buffer <buffer-keypair.json> …`, or reclaim the rent
with `solana program close <buffer-address> --recipient <your-wallet>`.

## Develop

```bash
# program
anchor build
pnpm codegen                 # regenerate web/src/generated from target/idl/savora.json
pnpm test:program            # LiteSVM suite (loads target/deploy/savora.so) — 18 tests

# web
cd web
cp .env.example .env.local   # fill NEXT_PUBLIC_PRIVY_APP_ID + your RPC URL
pnpm dev                     # http://localhost:3000
```

`NEXT_PUBLIC_SAVORA_DEMO=1 pnpm dev` renders the full UI from fixtures — still
needs a Privy app id, but no wallet funds or live program.

Embedded-wallet users start with zero SOL for fees; the profile page has a
devnet SOL airdrop button and a link to Circle's USDC faucet.

## Deploy the web app

Live at <https://usesavora.vercel.app>. See [`web/README.md`](web/README.md) —
in short: `cd web && vercel`, set the `NEXT_PUBLIC_*` env vars, `vercel --prod`,
then whitelist the domain in the Privy dashboard.

SEO metadata, `robots.txt`, `sitemap.xml`, the manifest, the favicon, and every
Open Graph image (including a per-circle card for `/g/<address>` links) are
generated from code — the mark lives in `web/src/lib/brand.tsx`, the base URL in
`web/src/lib/site.ts`.

## Stack

Anchor 0.32.1 · `@solana/kit` 8 · Codama · LiteSVM · Next.js 16 · React 19 ·
Tailwind v4 · Privy (prebuilt connection UI, themed through config) · motion.

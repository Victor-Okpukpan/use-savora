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
  src/app/            /  ·  /app (Circles · Activity · Profile)  ·  /app/new  ·  /g/[address]  ·  /docs
```

## How it works

| | |
|---|---|
| **Membership** | Open invite link (`/g/<groupPda>`). Anyone joins until the seats fill, then the group seals itself and cycle 1 opens. |
| **Rotation order** | Deterministic Fisher–Yates shuffle at seal, seeded from a recent slot hash mixed with the group PDA. No party chooses it; anyone can recompute it. *Caveat: a block leader controlling the sealing slot can bias the slot hash — acceptable for a circle of people who know each other, and stated plainly in the UI.* |
| **Payout** | Purely permissionless crank (`disburse_payout`). Any signer triggers it once the cycle is funded — or once its deadline passes. The recipient is fixed by rotation order; the recipient token account is constrained to that member and `group.mint`, so the caller cannot redirect funds. |
| **Defaults** | After the deadline the crank pays out whatever was pooled and writes each missed contribution against that member (`Group.missed`). The rotation never stalls; enforcement is social and visible. |

## Deployment — Solana devnet

| | |
|---|---|
| **Program ID** | `BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2` |
| **ProgramData** | `JAvBqYpG9MoiR6iwYherdHchWDjg7CzMo3indGYCDk5w` |
| **Upgrade authority** | `AL3LxYBsFcShcGq7kuQSA4mN8dSVKyvNQdHsQE9WT7VX` |
| **IDL account** | `GVjyn6Gbn9dTr8AVdJzArD6YGr9e8xzndWcryghfstMD` |
| **Cluster** | devnet · first deployed in slot 489374645 · 334 992 bytes |
| **USDC mint** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (Circle devnet, 6 decimals) — faucet at <https://faucet.circle.com> |

Explorer: <https://explorer.solana.com/address/BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2?cluster=devnet>

The program ID is hardcoded in `declare_id!` ([`programs/savora/src/lib.rs`](programs/savora/src/lib.rs)) and flows to the frontend through the generated client (`web/src/lib/savora/config.ts` → `SAVORA_PROGRAM_ADDRESS`).

### Redeploying the program

The public devnet RPC rate-limits large uploads; use a dedicated endpoint
(Alchemy / Helius / Triton free tier) as `--provider.cluster` or in
`solana config set --url`.

```bash
# from repo root, with `solana config` already pointed at a dedicated RPC
anchor build
solana program deploy \
  --program-id target/deploy/savora-keypair.json \
  --with-compute-unit-price 50000 --max-sign-attempts 100 \
  target/deploy/savora.so

# IDL (run once after the first deploy; use `anchor idl upgrade` thereafter)
anchor idl upgrade BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2 \
  --filepath target/idl/savora.json \
  --provider.cluster "$(solana config get | awk '/RPC URL/{print $3}')" \
  --provider.wallet ~/.config/solana/id.json
```

If a deploy is interrupted it leaves a funded buffer; resume with
`solana program deploy --buffer <buffer-keypair.json> …`, or reclaim the rent
with `solana program close <buffer-address> --recipient <your-wallet>`.

## Develop

```bash
# program
anchor build
pnpm codegen                 # regenerate web/src/generated from target/idl/savora.json
pnpm test:program            # LiteSVM suite (loads target/deploy/savora.so) — 9 tests

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

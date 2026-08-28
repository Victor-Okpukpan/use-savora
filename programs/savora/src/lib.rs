use anchor_lang::prelude::*;

mod constants;
mod errors;
mod instructions;
mod state;
mod util;

use constants::NAME_LEN;
use instructions::*;

declare_id!("BbXwxUfyF2xZydVZRhFZ5Fp5KALf9bgYEZvi7b3bhtG2");

/// Savora — non-custodial rotating savings circles (ajo) on Solana.
///
/// A fixed group contributes a set amount each cycle; one member collects the
/// whole pool per rotation until everyone has collected once, then the circle
/// can run further rotations if every member agrees. The pool lives in a
/// program-owned vault. There is no admin authority anywhere in this program:
/// no pause, no sweep (bar abandoning an unfilled circle), no way for any
/// party to take custody or redirect a payout.
///
/// Members lock a security deposit at join. Missing a contribution past the
/// deadline and grace window forfeits that deposit into the round it was owed
/// to, and ejects the member from the rotation.
#[program]
pub mod savora {
    use super::*;

    /// Open a new circle. The creator becomes member 0, locks the security
    /// deposit, and the vault ATA is created. Status starts as `Forming`.
    #[allow(clippy::too_many_arguments)]
    pub fn create_group(
        ctx: Context<CreateGroup>,
        seed: u64,
        name: [u8; NAME_LEN],
        contribution: u64,
        deposit: u64,
        cycle_secs: i64,
        grace_secs: i64,
        capacity: u8,
        rotations: u8,
    ) -> Result<()> {
        instructions::create_group::handler(
            ctx,
            seed,
            name,
            contribution,
            deposit,
            cycle_secs,
            grace_secs,
            capacity,
            rotations,
        )
    }

    /// Join a forming circle via its invite link, locking the security deposit.
    /// When the last seat fills, the roster locks and status goes `Active`; the
    /// first `open_cycle` builds and shuffles the rotation.
    pub fn join_group(ctx: Context<JoinGroup>) -> Result<()> {
        instructions::join_group::handler(ctx)
    }

    /// Leave a circle that is still forming. Refunds the deposit. Creator
    /// cannot leave (they use `close_group` instead).
    pub fn leave_group(ctx: Context<LeaveGroup>) -> Result<()> {
        instructions::leave_group::handler(ctx)
    }

    /// Create the account for the current cycle. Permissionless; the client
    /// bundles it with the first contribution when the account is missing. At a
    /// rotation boundary this is also where the rotation order is (re)shuffled.
    pub fn open_cycle(ctx: Context<OpenCycle>) -> Result<()> {
        instructions::open_cycle::handler(ctx)
    }

    /// Pay this cycle's fixed contribution into the vault. Accepted until the
    /// deadline plus the grace window. If this is the last contribution the
    /// round needs, the payout is sent in the same transaction.
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        instructions::contribute::handler(ctx)
    }

    /// Permissionless crank: once the grace window has closed with money still
    /// missing, eject the no-shows (forfeiting their deposit into this round),
    /// send the pool to the rotation-designated recipient, and advance.
    pub fn disburse_payout(ctx: Context<DisbursePayout>) -> Result<()> {
        instructions::disburse_payout::handler(ctx)
    }

    /// Creator only, on a `Completed` circle: propose running more rotations.
    /// Seals once every live member has opted in.
    pub fn propose_extension(
        ctx: Context<ProposeExtension>,
        additional_rotations: u8,
        optin_secs: i64,
    ) -> Result<()> {
        instructions::propose_extension::handler(ctx, additional_rotations, optin_secs)
    }

    /// Opt into a proposed extension. When the last live member opts in the
    /// circle returns to `Active` and reshuffles for the new rotation.
    pub fn opt_in_extension(ctx: Context<OptInExtension>) -> Result<()> {
        instructions::opt_in_extension::handler(ctx)
    }

    /// Withdraw a proposed extension (creator any time) or clear a stale one
    /// (anyone, once the opt-in window has closed).
    pub fn cancel_extension(ctx: Context<CancelExtension>) -> Result<()> {
        instructions::cancel_extension::handler(ctx)
    }

    /// Withdraw the security deposit and end membership. Allowed on
    /// `Completed`, `Extending` (this is how you decline), or `Failed`.
    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
    }

    /// Abandon a circle that never filled. Creator only, `Forming` only,
    /// `seat_count == 1`. Refunds the deposit and closes both accounts.
    pub fn close_group(ctx: Context<CloseGroup>) -> Result<()> {
        instructions::close_group::handler(ctx)
    }
}

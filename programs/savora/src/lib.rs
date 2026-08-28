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
/// A fixed group contributes a set USDC amount each cycle; one member collects
/// the whole pool per rotation until everyone has collected once. The pool
/// lives in a program-owned vault. There is no admin authority anywhere in
/// this program: no pause, no sweep, no way for any party to take custody.
#[program]
pub mod savora {
    use super::*;

    /// Open a new circle. The creator becomes member 0 and the vault ATA is
    /// created. Status starts as `Forming`.
    pub fn create_group(
        ctx: Context<CreateGroup>,
        seed: u64,
        name: [u8; NAME_LEN],
        contribution: u64,
        cycle_secs: i64,
        capacity: u8,
    ) -> Result<()> {
        instructions::create_group::handler(ctx, seed, name, contribution, cycle_secs, capacity)
    }

    /// Join a forming circle via its invite link. When the last seat fills,
    /// the roster locks, the rotation is shuffled on-chain, and cycle 0 starts.
    pub fn join_group(ctx: Context<JoinGroup>) -> Result<()> {
        instructions::join_group::handler(ctx)
    }

    /// Leave a circle that is still forming. Creator cannot leave.
    pub fn leave_group(ctx: Context<LeaveGroup>) -> Result<()> {
        instructions::leave_group::handler(ctx)
    }

    /// Create the account for the current cycle. Permissionless; the client
    /// bundles it with the first contribution when the account is missing.
    pub fn open_cycle(ctx: Context<OpenCycle>) -> Result<()> {
        instructions::open_cycle::handler(ctx)
    }

    /// Pay this cycle's fixed contribution into the vault. Accepted any time
    /// before the cycle is cranked.
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        instructions::contribute::handler(ctx)
    }

    /// Permissionless crank: once the cycle is fully funded — or once its
    /// deadline has passed — send the pool to the rotation-designated
    /// recipient, record any no-shows, and advance the rotation.
    pub fn disburse_payout(ctx: Context<DisbursePayout>) -> Result<()> {
        instructions::disburse_payout::handler(ctx)
    }
}

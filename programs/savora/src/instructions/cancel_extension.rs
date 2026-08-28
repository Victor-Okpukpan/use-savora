use anchor_lang::prelude::*;

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct CancelExtension<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,
}

pub fn handler(ctx: Context<CancelExtension>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let signer = ctx.accounts.signer.key();
    let group = &mut ctx.accounts.group;

    require!(
        group.status == GroupStatus::Extending,
        SavoraError::NotExtending
    );
    // The creator can pull a proposal any time; anyone can clear a stale one
    // once the opt-in window has closed.
    require!(
        signer == group.creator || now > group.optin_deadline,
        SavoraError::CreatorOnly
    );

    group.status = GroupStatus::Completed;
    group.pending_rotations = 0;
    group.optin_mask = 0;
    group.optin_deadline = 0;

    Ok(())
}

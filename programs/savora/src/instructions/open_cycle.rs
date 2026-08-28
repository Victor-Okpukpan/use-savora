use anchor_lang::prelude::*;

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED},
    errors::SavoraError,
    state::{Cycle, Group, GroupStatus},
};

#[derive(Accounts)]
pub struct OpenCycle<'info> {
    /// Permissionless: anyone can open the next cycle's account. The client
    /// bundles this with the first `contribute` when the account is missing.
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(
        init,
        payer = payer,
        space = 8 + Cycle::INIT_SPACE,
        seeds = [CYCLE_SEED, group.key().as_ref(), &[group.current_cycle]],
        bump
    )]
    pub cycle: Box<Account<'info, Cycle>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenCycle>) -> Result<()> {
    let group = &ctx.accounts.group;

    require!(group.status == GroupStatus::Active, SavoraError::GroupNotActive);
    require!(
        group.current_cycle < group.member_count,
        SavoraError::RotationComplete
    );

    let cycle = &mut ctx.accounts.cycle;
    cycle.bump = ctx.bumps.cycle;
    cycle.group = group.key();
    cycle.index = group.current_cycle;
    cycle.recipient_index = group.rotation[group.current_cycle as usize];
    cycle.deadline = group
        .cycle_start
        .checked_add(group.cycle_secs)
        .ok_or(SavoraError::MathOverflow)?;
    cycle.pooled = 0;
    cycle.contributed = 0;
    cycle.contributor_count = 0;
    cycle.disbursed = false;
    cycle.payout = 0;

    Ok(())
}

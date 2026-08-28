use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::{GROUP_SEED, MAX_MEMBERS, MIN_CYCLE_SECS, NAME_LEN},
    errors::SavoraError,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct CreateGroup<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Group::INIT_SPACE,
        seeds = [GROUP_SEED, creator.key().as_ref(), &seed.to_le_bytes()],
        bump
    )]
    pub group: Box<Account<'info, Group>>,

    /// Token this circle contributes and pays out in. Pinned here; every later
    /// instruction checks its token accounts against `group.mint`.
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// Non-custodial vault: an ATA owned by the group PDA. Only the program can
    /// move funds out of it, and only along the rotation.
    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = group,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateGroup>,
    seed: u64,
    name: [u8; NAME_LEN],
    contribution: u64,
    cycle_secs: i64,
    capacity: u8,
) -> Result<()> {
    require!(contribution > 0, SavoraError::InvalidParams);
    require!(cycle_secs >= MIN_CYCLE_SECS, SavoraError::InvalidParams);
    require!(
        (2..=MAX_MEMBERS as u8).contains(&capacity),
        SavoraError::InvalidParams
    );

    let group = &mut ctx.accounts.group;
    group.bump = ctx.bumps.group;
    group.vault_bump = 0; // vault is a standard ATA; bump kept for symmetry only
    group.creator = ctx.accounts.creator.key();
    group.seed = seed;
    group.mint = ctx.accounts.mint.key();
    group.name = name;
    group.contribution = contribution;
    group.cycle_secs = cycle_secs;
    group.capacity = capacity;
    group.member_count = 1;
    group.members = [Pubkey::default(); MAX_MEMBERS];
    group.members[0] = ctx.accounts.creator.key();
    group.rotation = [0u8; MAX_MEMBERS];
    group.missed = [0u16; MAX_MEMBERS];
    group.status = GroupStatus::Forming;
    group.current_cycle = 0;
    group.cycle_start = 0;

    Ok(())
}

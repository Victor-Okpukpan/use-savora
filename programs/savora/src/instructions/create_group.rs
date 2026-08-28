use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::{
        GROUP_SEED, MAX_GRACE_SECS, MAX_MEMBERS, MAX_ROTATIONS, MIN_ACTIVE, MIN_CYCLE_SECS, NAME_LEN,
    },
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
    /// instruction checks its token accounts against `group.mint`. Constrained
    /// to a classic SPL Token mint so no Token-2022 extension (transfer hook,
    /// transfer fee, pause) can break the vault accounting mid-rotation.
    #[account(owner = anchor_spl::token::ID @ SavoraError::UnsupportedMint)]
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

    /// The creator's own token account — their security deposit is pulled from
    /// here into the vault, same as every other member at join.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
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
    require!(contribution > 0, SavoraError::InvalidParams);
    require!(deposit >= contribution, SavoraError::InvalidParams);
    require!(cycle_secs >= MIN_CYCLE_SECS, SavoraError::InvalidParams);
    require!(
        (0..=MAX_GRACE_SECS).contains(&grace_secs),
        SavoraError::InvalidParams
    );
    require!(
        (MIN_ACTIVE..=MAX_MEMBERS as u8).contains(&capacity),
        SavoraError::InvalidParams
    );
    require!(
        (1..=MAX_ROTATIONS).contains(&rotations),
        SavoraError::InvalidParams
    );

    let creator = ctx.accounts.creator.key();
    let group = &mut ctx.accounts.group;
    group.bump = ctx.bumps.group;
    group.creator = creator;
    group.seed = seed;
    group.mint = ctx.accounts.mint.key();
    group.name = name;
    group.contribution = contribution;
    group.deposit = deposit;
    group.cycle_secs = cycle_secs;
    group.grace_secs = grace_secs;
    group.capacity = capacity;
    group.seat_count = 1;
    group.members = [Pubkey::default(); MAX_MEMBERS];
    group.members[0] = creator;
    group.rotation = [0u8; MAX_MEMBERS];
    group.rotation_len = 0;
    group.rotation_pos = 0;
    group.rotations_target = rotations;
    group.rotations_done = 0;
    group.pending_rotations = 0;
    group.ejected = 0;
    group.defaulted = 0;
    group.optin_mask = 0;
    group.optin_deadline = 0;
    group.status = GroupStatus::Forming;
    group.current_cycle = 0;
    group.opened_at = 0;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.creator_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.mint.decimals,
    )?;

    Ok(())
}

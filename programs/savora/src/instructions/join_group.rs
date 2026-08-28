use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct JoinGroup<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(address = group.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = member,
    )]
    pub member_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = group,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<JoinGroup>) -> Result<()> {
    let member = ctx.accounts.member.key();
    let deposit = ctx.accounts.group.deposit;

    {
        let group = &ctx.accounts.group;
        require!(
            group.status == GroupStatus::Forming,
            SavoraError::GroupNotForming
        );
        require!(group.seat_count < group.capacity, SavoraError::GroupFull);
        require!(!group.is_member(&member), SavoraError::AlreadyMember);
    }

    // Deposit first, so the roster only grows once the money is in the vault.
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.member_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.member.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.mint.decimals,
    )?;

    let group = &mut ctx.accounts.group;
    let idx = group.seat_count as usize;
    group.members[idx] = member;
    group.seat_count += 1;

    // Last seat filled: lock the roster and go Active at a rotation boundary.
    // The rotation is built and shuffled by the first `open_cycle` (see
    // `Group::at_rotation_boundary`), which is also where every later reshuffle
    // happens — one code path for all of it.
    if group.seat_count == group.capacity {
        group.status = GroupStatus::Active;
        group.rotation_len = 0;
        group.rotation_pos = 0;
    }

    Ok(())
}

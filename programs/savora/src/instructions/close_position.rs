use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    instructions::shared::{transfer_from_vault, try_seal_extension},
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct ClosePosition<'info> {
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

/// Withdraw the security deposit and end membership. This is the exit hatch
/// for all three cases: taking your deposit back after the circle completes,
/// declining a proposed extension, and collecting after a collapse.
///
/// Withdrawing is permanent — the slot is tombstoned, so a member who
/// withdraws at `Completed` cannot later opt into an extension.
pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    let member = ctx.accounts.member.key();
    let deposit = ctx.accounts.group.deposit;

    let i = {
        let group = &ctx.accounts.group;
        require!(
            matches!(
                group.status,
                GroupStatus::Completed | GroupStatus::Extending | GroupStatus::Failed
            ),
            SavoraError::CannotExitNow
        );
        let i = group
            .member_index(&member)
            .ok_or(SavoraError::NotAMember)?;
        require!(group.is_live(i), SavoraError::AlreadyExited);
        i
    };

    {
        let group = &mut ctx.accounts.group;
        group.ejected |= 1u16 << i;
        // A departing member can't still be counted toward a pending extension.
        group.optin_mask &= group.live_mask();
    }

    transfer_from_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.member_token.to_account_info(),
        &ctx.accounts.group,
        deposit,
    )?;

    // If this exit was the last decline standing between the rest and a sealed
    // extension, seal it now.
    if ctx.accounts.group.status == GroupStatus::Extending {
        try_seal_extension(&mut ctx.accounts.group);
    }

    Ok(())
}

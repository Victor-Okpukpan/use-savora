use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    instructions::shared::transfer_from_vault,
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

/// Withdraw the security deposit and end membership. The exit hatch for
/// taking your deposit back after the circle completes or collapses, and for
/// declining a proposed extension.
///
/// Withdrawing is permanent — the slot is tombstoned. Doing it while an
/// extension is pending is a hard **no**: it cancels the whole proposal and
/// returns the circle to `Completed`, since an extension needs every member.
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
        // Withdrawing during a pending extension is a decline: kill the whole
        // proposal (an extension is all-or-nothing) and drop back to Completed.
        if group.status == GroupStatus::Extending {
            group.status = GroupStatus::Completed;
            group.pending_rotations = 0;
            group.optin_deadline = 0;
            group.optin_mask = 0;
        } else {
            group.optin_mask &= group.live_mask();
        }
    }

    transfer_from_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.member_token.to_account_info(),
        &ctx.accounts.group,
        deposit,
    )?;

    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{close_account, CloseAccount, Mint, TokenAccount, TokenInterface};

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    instructions::shared::transfer_from_vault,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct CloseGroup<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        close = creator,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
        has_one = creator @ SavoraError::CreatorOnly,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(address = group.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = group,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

/// Abandon a circle that never filled. Only the creator, only while `Forming`,
/// and only once every other member has left (`seat_count == 1`). Refunds the
/// creator's deposit, then closes the vault ATA and the group account, both
/// rent-returning to the creator.
pub fn handler(ctx: Context<CloseGroup>) -> Result<()> {
    {
        let group = &ctx.accounts.group;
        require!(
            group.status == GroupStatus::Forming,
            SavoraError::GroupNotForming
        );
        require!(group.seat_count == 1, SavoraError::GroupNotEmpty);
    }

    // With one seat and no cycles, the only rightful claim on the vault is the
    // creator's own deposit; any excess is an unattributable donation and is
    // swept here (the one and only sweep in the program).
    let balance = ctx.accounts.vault.amount;
    if balance > 0 {
        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            &ctx.accounts.creator_token.to_account_info(),
            &ctx.accounts.group,
            balance,
        )?;
    }

    let creator = ctx.accounts.group.creator;
    let seed_bytes = ctx.accounts.group.seed.to_le_bytes();
    let bump = [ctx.accounts.group.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[GROUP_SEED, creator.as_ref(), &seed_bytes, &bump]];

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.creator.to_account_info(),
            authority: ctx.accounts.group.to_account_info(),
        },
        signer_seeds,
    ))?;

    Ok(())
}

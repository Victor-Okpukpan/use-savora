use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED},
    errors::SavoraError,
    state::{Cycle, Group, GroupStatus},
};

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(
        mut,
        seeds = [CYCLE_SEED, group.key().as_ref(), &[cycle.index]],
        bump = cycle.bump,
        has_one = group,
    )]
    pub cycle: Box<Account<'info, Cycle>>,

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

pub fn handler(ctx: Context<Contribute>) -> Result<()> {
    let group = &ctx.accounts.group;
    require!(group.status == GroupStatus::Active, SavoraError::GroupNotActive);

    let cycle = &ctx.accounts.cycle;
    require!(!cycle.disbursed, SavoraError::CycleAlreadyDisbursed);

    // Late but present still counts: a contribution is accepted any time before
    // the cycle is cranked, deadline or no deadline.
    let member_index = group
        .member_index(&ctx.accounts.member.key())
        .ok_or(SavoraError::NotAMember)?;
    require!(
        !cycle.has_contributed(member_index),
        SavoraError::AlreadyContributed
    );

    let amount = group.contribution;
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
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let cycle = &mut ctx.accounts.cycle;
    cycle.mark_contributed(member_index);
    cycle.contributor_count += 1;
    cycle.pooled = cycle
        .pooled
        .checked_add(amount)
        .ok_or(SavoraError::MathOverflow)?;

    Ok(())
}

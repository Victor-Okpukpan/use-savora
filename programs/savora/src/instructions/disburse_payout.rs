use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED},
    errors::SavoraError,
    instructions::shared::{advance_rotation, compact_rotation_tail, transfer_from_vault},
    state::{Cycle, Group, GroupStatus},
};

#[derive(Accounts)]
pub struct DisbursePayout<'info> {
    /// Permissionless crank. Any signer can trigger the payout; the recipient
    /// is fixed by rotation order below, so the caller cannot redirect funds.
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(
        mut,
        seeds = [CYCLE_SEED, group.key().as_ref(), &cycle.index.to_le_bytes()],
        bump = cycle.bump,
        has_one = group,
    )]
    pub cycle: Box<Account<'info, Cycle>>,

    #[account(address = group.mint)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = group,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: the one check standing between the crank and misdirected funds —
    /// pinned to the member whose turn it is in the shuffled rotation.
    #[account(address = group.members[cycle.recipient_index as usize])]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_token: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DisbursePayout>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deposit = ctx.accounts.group.deposit;

    let full = {
        let group = &ctx.accounts.group;
        let cycle = &ctx.accounts.cycle;
        require!(
            group.status == GroupStatus::Active,
            SavoraError::GroupNotActive
        );
        require!(!cycle.disbursed, SavoraError::CycleAlreadyDisbursed);

        let full = cycle.fully_funded();
        let grace_over = now
            > cycle
                .deadline
                .checked_add(group.grace_secs)
                .ok_or(SavoraError::MathOverflow)?;
        require!(full || grace_over, SavoraError::CycleNotReady);
        full
    };

    // Grace has closed with money still missing: eject every no-show, forfeit
    // their deposit into this round's pot, and drop them from the rotation.
    if !full {
        let defaulters = ctx.accounts.cycle.defaulters();
        let forfeit = deposit
            .checked_mul(defaulters.count_ones() as u64)
            .ok_or(SavoraError::MathOverflow)?;

        {
            let group = &mut ctx.accounts.group;
            for d in 0..group.seat_count as usize {
                if defaulters & (1u16 << d) != 0 {
                    group.ejected |= 1u16 << d;
                    group.defaulted |= 1u16 << d;
                }
            }
            compact_rotation_tail(group, defaulters);
        }

        let cycle = &mut ctx.accounts.cycle;
        cycle.ejected_here = defaulters;
        cycle.pooled = cycle
            .pooled
            .checked_add(forfeit)
            .ok_or(SavoraError::MathOverflow)?;
    }

    let amount = ctx.accounts.cycle.pooled;
    if amount > 0 {
        transfer_from_vault(
            &ctx.accounts.token_program,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            &ctx.accounts.recipient_token.to_account_info(),
            &ctx.accounts.group,
            amount,
        )?;
    }

    {
        let cycle = &mut ctx.accounts.cycle;
        cycle.disbursed = true;
        cycle.payout = amount;
    }
    advance_rotation(&mut ctx.accounts.group)?;

    Ok(())
}

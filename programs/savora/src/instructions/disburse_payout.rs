use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED},
    errors::SavoraError,
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

    {
        let group = &ctx.accounts.group;
        let cycle = &ctx.accounts.cycle;
        require!(group.status == GroupStatus::Active, SavoraError::GroupNotActive);
        require!(!cycle.disbursed, SavoraError::CycleAlreadyDisbursed);
        require!(
            cycle.contributor_count == group.member_count || now > cycle.deadline,
            SavoraError::CycleNotReady
        );
    }

    let amount = ctx.accounts.cycle.pooled;

    // Move the pool to the rotation-designated recipient, signed by the group PDA.
    if amount > 0 {
        let creator = ctx.accounts.group.creator;
        let seed_bytes = ctx.accounts.group.seed.to_le_bytes();
        let bump = [ctx.accounts.group.bump];
        let signer_seeds: &[&[&[u8]]] =
            &[&[GROUP_SEED, creator.as_ref(), &seed_bytes, &bump]];

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.group.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
    }

    let member_count = ctx.accounts.group.member_count as usize;
    let contributed = ctx.accounts.cycle.contributed;

    // Record every no-show against their permanent counter. Enforcement is
    // social and visible — the rotation itself never stalls.
    {
        let group = &mut ctx.accounts.group;
        for i in 0..member_count {
            if contributed & (1u16 << i) == 0 {
                group.missed[i] = group.missed[i].saturating_add(1);
            }
        }
    }

    {
        let cycle = &mut ctx.accounts.cycle;
        cycle.disbursed = true;
        cycle.payout = amount;
    }

    let group = &mut ctx.accounts.group;
    group.current_cycle += 1;
    if group.current_cycle == group.member_count {
        group.status = GroupStatus::Completed;
    } else {
        group.cycle_start = now;
    }

    Ok(())
}

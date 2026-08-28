use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::get_associated_token_address_with_program_id,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED},
    errors::SavoraError,
    instructions::shared::{advance_rotation, transfer_from_vault},
    state::{Cycle, Group, GroupStatus},
};

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

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
        associated_token::authority = member,
    )]
    pub member_token: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = group,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: pinned to the rotation-designated recipient. Used only by the
    /// inline auto-disburse when this contribution completes the round.
    #[account(address = group.members[cycle.recipient_index as usize])]
    pub recipient: UncheckedAccount<'info>,

    /// CHECK: verified against the canonical ATA of `recipient` before any
    /// transfer; if it does not exist, the auto-disburse is skipped and the
    /// manual crank handles it (creating the ATA there).
    #[account(mut)]
    pub recipient_token: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Contribute>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let member = ctx.accounts.member.key();
    let contribution = ctx.accounts.group.contribution;
    let grace_secs = ctx.accounts.group.grace_secs;

    let member_index = {
        let group = &ctx.accounts.group;
        let cycle = &ctx.accounts.cycle;
        require!(
            group.status == GroupStatus::Active,
            SavoraError::GroupNotActive
        );
        require!(!cycle.disbursed, SavoraError::CycleAlreadyDisbursed);

        let window_end = cycle
            .deadline
            .checked_add(grace_secs)
            .ok_or(SavoraError::MathOverflow)?;
        require!(now <= window_end, SavoraError::ContributionWindowClosed);

        let i = group
            .member_index(&member)
            .ok_or(SavoraError::NotAMember)?;
        require!(
            cycle.required & (1u16 << i) != 0,
            SavoraError::MemberEjected
        );
        require!(!cycle.has_contributed(i), SavoraError::AlreadyContributed);
        i
    };

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
        contribution,
        ctx.accounts.mint.decimals,
    )?;

    let (fully_funded, pooled) = {
        let cycle = &mut ctx.accounts.cycle;
        cycle.mark_contributed(member_index);
        cycle.pooled = cycle
            .pooled
            .checked_add(contribution)
            .ok_or(SavoraError::MathOverflow)?;
        (cycle.fully_funded(), cycle.pooled)
    };

    // Auto-disburse: the last outstanding contribution pays the round out in
    // the same transaction, but only if the recipient's ATA already exists.
    // No ejection is ever possible here — `fully_funded` means nobody defaulted.
    if fully_funded {
        let recipient_token = ctx.accounts.recipient_token.to_account_info();
        if !recipient_token.data_is_empty() {
            let expected = get_associated_token_address_with_program_id(
                &ctx.accounts.recipient.key(),
                &ctx.accounts.group.mint,
                &ctx.accounts.token_program.key(),
            );
            require_keys_eq!(
                ctx.accounts.recipient_token.key(),
                expected,
                SavoraError::InvalidRecipientToken
            );

            transfer_from_vault(
                &ctx.accounts.token_program,
                &ctx.accounts.vault,
                &ctx.accounts.mint,
                &recipient_token,
                &ctx.accounts.group,
                pooled,
            )?;

            {
                let cycle = &mut ctx.accounts.cycle;
                cycle.disbursed = true;
                cycle.payout = pooled;
            }
            advance_rotation(&mut ctx.accounts.group)?;
        }
    }

    Ok(())
}

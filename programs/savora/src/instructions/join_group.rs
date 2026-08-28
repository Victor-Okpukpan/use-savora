use anchor_lang::prelude::*;

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    state::{Group, GroupStatus},
    util::recent_slot_hash,
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

    /// CHECK: address-constrained to the SlotHashes sysvar; parsed manually in
    /// `recent_slot_hash` to seed the rotation shuffle when the roster seals.
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::id())]
    pub slot_hashes: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<JoinGroup>) -> Result<()> {
    let group_key = ctx.accounts.group.key();
    let member = ctx.accounts.member.key();
    let group = &mut ctx.accounts.group;

    require!(
        group.status == GroupStatus::Forming,
        SavoraError::GroupNotForming
    );
    require!(
        group.member_count < group.capacity,
        SavoraError::GroupFull
    );
    require!(!group.is_member(&member), SavoraError::AlreadyMember);

    let idx = group.member_count as usize;
    group.members[idx] = member;
    group.member_count += 1;

    // Last seat filled: lock the roster, shuffle the rotation, start cycle 0.
    if group.member_count == group.capacity {
        let slot_hash = recent_slot_hash(&ctx.accounts.slot_hashes.to_account_info())?;
        group.seal_rotation(&group_key, &slot_hash);
        group.status = GroupStatus::Active;
        group.current_cycle = 0;
        group.cycle_start = Clock::get()?.unix_timestamp;
    }

    Ok(())
}

use anchor_lang::prelude::*;

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct LeaveGroup<'info> {
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,
}

pub fn handler(ctx: Context<LeaveGroup>) -> Result<()> {
    let member = ctx.accounts.member.key();
    let group = &mut ctx.accounts.group;

    require!(
        group.status == GroupStatus::Forming,
        SavoraError::GroupNotForming
    );

    let idx = group.member_index(&member).ok_or(SavoraError::NotAMember)?;
    require!(idx != 0, SavoraError::CreatorCannotLeave);

    // Shift the tail down so `members[0..member_count]` stays contiguous.
    let last = group.member_count as usize - 1;
    for i in idx..last {
        group.members[i] = group.members[i + 1];
    }
    group.members[last] = Pubkey::default();
    group.member_count -= 1;

    Ok(())
}

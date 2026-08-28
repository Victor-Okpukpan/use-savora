use anchor_lang::prelude::*;

use crate::{
    constants::GROUP_SEED,
    errors::SavoraError,
    instructions::shared::try_seal_extension,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct OptInExtension<'info> {
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,
}

pub fn handler(ctx: Context<OptInExtension>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let member = ctx.accounts.member.key();
    let group = &mut ctx.accounts.group;

    require!(
        group.status == GroupStatus::Extending,
        SavoraError::NotExtending
    );
    require!(now <= group.optin_deadline, SavoraError::OptInWindowClosed);

    let i = group
        .member_index(&member)
        .ok_or(SavoraError::NotAMember)?;
    require!(group.is_live(i), SavoraError::MemberEjected);
    require!(
        group.optin_mask & (1u16 << i) == 0,
        SavoraError::AlreadyOptedIn
    );

    group.optin_mask |= 1u16 << i;
    try_seal_extension(group);

    Ok(())
}

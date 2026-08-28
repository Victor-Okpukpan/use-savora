use anchor_lang::prelude::*;

use crate::{
    constants::{GROUP_SEED, MAX_OPTIN_SECS, MAX_ROTATIONS, MIN_ACTIVE, MIN_OPTIN_SECS},
    errors::SavoraError,
    instructions::shared::try_seal_extension,
    state::{Group, GroupStatus},
};

#[derive(Accounts)]
pub struct ProposeExtension<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,
}

pub fn handler(
    ctx: Context<ProposeExtension>,
    additional_rotations: u8,
    optin_secs: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let group = &mut ctx.accounts.group;

    require_keys_eq!(
        ctx.accounts.creator.key(),
        group.creator,
        SavoraError::CreatorOnly
    );
    require!(
        group.status == GroupStatus::Completed,
        SavoraError::NotCompleted
    );
    // The creator withdrew their deposit at completion — they are no longer a
    // member and cannot re-commit the others.
    require!(group.is_live(0), SavoraError::CreatorHasExited);
    require!(additional_rotations >= 1, SavoraError::InvalidParams);
    require!(
        group
            .rotations_target
            .checked_add(additional_rotations)
            .is_some_and(|t| t <= MAX_ROTATIONS),
        SavoraError::InvalidParams
    );
    require!(
        (MIN_OPTIN_SECS..=MAX_OPTIN_SECS).contains(&optin_secs),
        SavoraError::InvalidParams
    );
    require!(
        group.active_count() >= MIN_ACTIVE,
        SavoraError::CircleCollapsed
    );

    group.status = GroupStatus::Extending;
    group.pending_rotations = additional_rotations;
    group.optin_deadline = now
        .checked_add(optin_secs)
        .ok_or(SavoraError::MathOverflow)?;
    // Proposing is consent: count the creator in immediately.
    group.optin_mask = 1u16 << 0;

    try_seal_extension(group);

    Ok(())
}

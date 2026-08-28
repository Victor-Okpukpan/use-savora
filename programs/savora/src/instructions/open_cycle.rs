use anchor_lang::prelude::*;

use crate::{
    constants::{CYCLE_SEED, GROUP_SEED, MIN_ACTIVE},
    errors::SavoraError,
    state::{Cycle, Group, GroupStatus},
    util::recent_slot_hash,
};

#[derive(Accounts)]
pub struct OpenCycle<'info> {
    /// Permissionless: anyone can open the next cycle's account. The client
    /// bundles this with the first `contribute` when the account is missing.
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.seed.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Box<Account<'info, Group>>,

    #[account(
        init,
        payer = payer,
        space = 8 + Cycle::INIT_SPACE,
        seeds = [CYCLE_SEED, group.key().as_ref(), &group.current_cycle.to_le_bytes()],
        bump
    )]
    pub cycle: Box<Account<'info, Cycle>>,

    /// CHECK: address-constrained to the SlotHashes sysvar; parsed manually in
    /// `recent_slot_hash` to seed the rotation shuffle at a rotation boundary.
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::id())]
    pub slot_hashes: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenCycle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let group_key = ctx.accounts.group.key();
    let group = &mut ctx.accounts.group;

    require!(
        group.status == GroupStatus::Active,
        SavoraError::GroupNotActive
    );
    require!(
        group.rotations_done < group.rotations_target,
        SavoraError::RotationComplete
    );
    require!(
        group.active_count() >= MIN_ACTIVE,
        SavoraError::CircleCollapsed
    );

    // At a rotation boundary (first cycle after seal, or first cycle of a new
    // rotation) rebuild `rotation` from the live members and reshuffle.
    if group.at_rotation_boundary() {
        let live = group.live_mask();
        let mut k = 0usize;
        for i in 0..group.seat_count as usize {
            if live & (1u16 << i) != 0 {
                group.rotation[k] = i as u8;
                k += 1;
            }
        }
        for slot in group.rotation.iter_mut().skip(k) {
            *slot = 0;
        }

        let slot_hash = recent_slot_hash(&ctx.accounts.slot_hashes.to_account_info())?;
        let (rd, cc) = (group.rotations_done, group.current_cycle);
        group.shuffle(&group_key, &slot_hash, rd, cc, k);
        group.rotation_len = k as u8;
        group.rotation_pos = 0;
    }

    let recipient_index = group.rotation[group.rotation_pos as usize];

    let cycle = &mut ctx.accounts.cycle;
    cycle.bump = ctx.bumps.cycle;
    cycle.group = group_key;
    cycle.index = group.current_cycle;
    cycle.rotation_index = group.rotations_done;
    cycle.recipient_index = recipient_index;
    cycle.opened_at = now;
    cycle.deadline = now
        .checked_add(group.cycle_secs)
        .ok_or(SavoraError::MathOverflow)?;
    cycle.pooled = 0;
    // The recipient owes nothing this round — pre-set their bit so the
    // "who still owes" mask is just `required & !contributed`.
    cycle.required = group.live_mask();
    cycle.contributed = 1u16 << recipient_index;
    cycle.ejected_here = 0;
    cycle.disbursed = false;
    cycle.payout = 0;

    group.opened_at = now;

    Ok(())
}

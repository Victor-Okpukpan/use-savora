use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::{GROUP_SEED, MIN_ACTIVE},
    errors::SavoraError,
    state::{Group, GroupStatus},
};

/// Move `amount` out of the group vault, signed by the group PDA.
///
/// `to` is an `AccountInfo` so the same helper serves both a checked
/// `InterfaceAccount` recipient (the manual crank) and a raw `UncheckedAccount`
/// recipient (the auto-disburse path, which has already verified the ATA).
pub fn transfer_from_vault<'info>(
    token_program: &Interface<'info, TokenInterface>,
    vault: &InterfaceAccount<'info, TokenAccount>,
    mint: &InterfaceAccount<'info, Mint>,
    to: &AccountInfo<'info>,
    group: &Account<'info, Group>,
    amount: u64,
) -> Result<()> {
    let creator = group.creator;
    let seed_bytes = group.seed.to_le_bytes();
    let bump = [group.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[GROUP_SEED, creator.as_ref(), &seed_bytes, &bump]];

    transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.clone(),
                authority: group.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        mint.decimals,
    )
}

/// Advance the round counter after a disbursement (manual crank or the inline
/// auto-disburse). Called with `group` already reflecting any ejections from
/// this same instruction.
pub fn advance_rotation(group: &mut Group) -> Result<()> {
    group.rotation_pos = group
        .rotation_pos
        .checked_add(1)
        .ok_or(SavoraError::MathOverflow)?;
    group.current_cycle = group
        .current_cycle
        .checked_add(1)
        .ok_or(SavoraError::MathOverflow)?;

    if group.active_count() < MIN_ACTIVE {
        // Collapse wins over the rotation/completion branches.
        group.status = GroupStatus::Failed;
    } else if group.rotation_pos == group.rotation_len {
        group.rotations_done = group
            .rotations_done
            .checked_add(1)
            .ok_or(SavoraError::MathOverflow)?;
        if group.rotations_done == group.rotations_target {
            group.status = GroupStatus::Completed;
        }
        // Otherwise stay Active at the boundary; the next `open_cycle`
        // rebuilds and reshuffles `rotation` for the new pass.
    }
    Ok(())
}

/// Remove ejected slots from the not-yet-collected tail of `rotation`, keeping
/// `rotation_len` equal to (payouts made this rotation) + (live members still
/// to collect this rotation). Entries at or before `rotation_pos` are history
/// and are left untouched.
pub fn compact_rotation_tail(group: &mut Group, ejected_slots: u16) {
    let start = group.rotation_pos as usize + 1;
    let end = group.rotation_len as usize;
    let mut w = start;
    for r in start..end {
        let slot = group.rotation[r];
        if ejected_slots & (1u16 << slot) == 0 {
            group.rotation[w] = slot;
            w += 1;
        }
    }
    for slot in group.rotation.iter_mut().take(end).skip(w) {
        *slot = 0;
    }
    group.rotation_len = w as u8;
}

/// If every live member has opted into the pending extension, seal it: grow the
/// rotation target and return to `Active` at a rotation boundary so the next
/// `open_cycle` reshuffles.
pub fn try_seal_extension(group: &mut Group) {
    if group.status != GroupStatus::Extending {
        return;
    }
    let live = group.live_mask();
    if live.count_ones() >= MIN_ACTIVE as u32 && (group.optin_mask & live) == live {
        group.rotations_target = group
            .rotations_target
            .saturating_add(group.pending_rotations);
        group.pending_rotations = 0;
        group.optin_mask = 0;
        group.status = GroupStatus::Active;
    }
}

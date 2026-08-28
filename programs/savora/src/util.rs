use anchor_lang::prelude::*;

use crate::errors::SavoraError;

/// Hash of the most recent slot, read straight from the `SlotHashes` sysvar.
///
/// Anchor has no typed accessor for this sysvar and `Sysvar::get` is
/// unsupported for it, so the account is passed in raw and parsed here.
/// Layout: `u64` LE entry count, then `count` entries of `{ u64 slot, [u8; 32]
/// hash }`, ordered most-recent-first.
pub fn recent_slot_hash(slot_hashes: &AccountInfo) -> Result<[u8; 32]> {
    let data = slot_hashes
        .try_borrow_data()
        .map_err(|_| error!(SavoraError::SlotHashesUnavailable))?;

    // 8 (count) + 8 (slot) + 32 (hash) for at least one entry.
    require!(data.len() >= 48, SavoraError::SlotHashesUnavailable);
    let count = u64::from_le_bytes(data[0..8].try_into().unwrap());
    require!(count > 0, SavoraError::SlotHashesUnavailable);

    let hash_start = 8 + 8; // skip count, skip entry 0's slot number
    let mut out = [0u8; 32];
    out.copy_from_slice(&data[hash_start..hash_start + 32]);
    Ok(out)
}

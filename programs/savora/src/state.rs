use anchor_lang::prelude::*;

use crate::constants::{MAX_MEMBERS, NAME_LEN};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum GroupStatus {
    /// Seats still open; roster not yet locked.
    Forming,
    /// Roster locked, rotation shuffled, cycles running.
    Active,
    /// Every member has collected once.
    Completed,
}

#[account]
#[derive(InitSpace)]
pub struct Group {
    pub bump: u8,
    pub vault_bump: u8,
    pub creator: Pubkey,
    pub seed: u64,
    /// Mint pinned at creation. Every token account is checked against this.
    pub mint: Pubkey,
    pub name: [u8; NAME_LEN],
    /// Fixed USDC amount each member owes per cycle, in base units.
    pub contribution: u64,
    /// Length of one cycle in seconds.
    pub cycle_secs: i64,
    /// Seats in the circle. Roster seals when `member_count == capacity`.
    pub capacity: u8,
    pub member_count: u8,
    pub members: [Pubkey; MAX_MEMBERS],
    /// Shuffled member indices; `rotation[k]` collects during cycle `k`.
    /// Written once, at seal. Zeroed slots past `member_count` are unused.
    pub rotation: [u8; MAX_MEMBERS],
    /// Permanent per-member counter of missed contributions.
    pub missed: [u16; MAX_MEMBERS],
    pub status: GroupStatus,
    /// Index of the cycle currently in progress (0-based).
    pub current_cycle: u8,
    /// Unix time the current cycle's clock started (seal, or previous payout).
    pub cycle_start: i64,
}

impl Group {
    pub fn is_member(&self, key: &Pubkey) -> bool {
        self.member_index(key).is_some()
    }

    pub fn member_index(&self, key: &Pubkey) -> Option<usize> {
        self.members[..self.member_count as usize]
            .iter()
            .position(|m| m == key)
    }

    /// Deterministic Fisher–Yates shuffle of `rotation[0..member_count]`.
    ///
    /// Seeded from a recent slot hash mixed with the group PDA, then expanded
    /// with SplitMix64. The order is fixed at seal and anyone can recompute and
    /// verify it, but no party chooses it. Documented limitation: a block
    /// leader who controls the sealing slot can bias the slot hash. Acceptable
    /// for a circle of people who know each other; surfaced honestly in the UI.
    pub fn seal_rotation(&mut self, group_key: &Pubkey, slot_hash: &[u8; 32]) {
        let n = self.member_count as usize;
        for i in 0..n {
            self.rotation[i] = i as u8;
        }

        let mut state = seed_u64(slot_hash, &group_key.to_bytes());

        // Walk i from n-1 down to 1, swapping with a uniform j in 0..=i.
        for i in (1..n).rev() {
            let j = (splitmix64(&mut state) % (i as u64 + 1)) as usize;
            self.rotation.swap(i, j);
        }
    }
}

/// Fold two 32-byte inputs into a single u64 seed.
fn seed_u64(a: &[u8; 32], b: &[u8; 32]) -> u64 {
    let mut acc = 0u64;
    for chunk in 0..4 {
        let lo = chunk * 8;
        acc ^= u64::from_le_bytes(a[lo..lo + 8].try_into().unwrap());
        acc = acc.rotate_left(17);
        acc ^= u64::from_le_bytes(b[lo..lo + 8].try_into().unwrap());
    }
    acc | 1 // never seed the generator with zero
}

/// SplitMix64 — a small, well-distributed deterministic PRNG.
fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

#[account]
#[derive(InitSpace)]
pub struct Cycle {
    pub bump: u8,
    pub group: Pubkey,
    pub index: u8,
    /// Member slot that collects this cycle: `group.members[recipient_index]`.
    pub recipient_index: u8,
    pub deadline: i64,
    /// USDC actually gathered in the vault for this cycle, in base units.
    pub pooled: u64,
    /// Bitmask over member slots: bit `i` set means member `i` has contributed.
    pub contributed: u16,
    pub contributor_count: u8,
    pub disbursed: bool,
    /// Amount actually paid to the recipient (may be short of the full pool).
    pub payout: u64,
}

impl Cycle {
    pub fn has_contributed(&self, member_index: usize) -> bool {
        self.contributed & (1u16 << member_index) != 0
    }

    pub fn mark_contributed(&mut self, member_index: usize) {
        self.contributed |= 1u16 << member_index;
    }
}

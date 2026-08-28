use anchor_lang::prelude::*;

use crate::constants::{MAX_MEMBERS, NAME_LEN};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum GroupStatus {
    /// Seats still open; roster not yet locked.
    Forming,
    /// Roster locked, rotation(s) running.
    Active,
    /// Every agreed rotation has finished. Not terminal: the creator may
    /// propose an extension, and members may withdraw their deposit.
    Completed,
    /// An extension has been proposed and is waiting for every live member to
    /// opt in. Declining (via `close_position`) refunds the deposit and exits.
    Extending,
    /// The circle collapsed below `MIN_ACTIVE` live members. Terminal; the only
    /// remaining action is `close_position` to withdraw a still-held deposit.
    Failed,
}

#[account]
#[derive(InitSpace)]
pub struct Group {
    pub bump: u8,
    pub creator: Pubkey,
    pub seed: u64,
    /// Mint pinned at creation. Every token account is checked against this.
    pub mint: Pubkey,
    pub name: [u8; NAME_LEN],
    /// Fixed amount each member owes per cycle, in base units.
    pub contribution: u64,
    /// Locked by every member at join, refunded on a clean exit, forfeited on
    /// default. Always `>= contribution`.
    pub deposit: u64,
    /// Length of one cycle in seconds.
    pub cycle_secs: i64,
    /// Extra seconds after the deadline in which a late contribution still
    /// counts and the crank stays blocked (unless already fully funded).
    pub grace_secs: i64,
    /// Seats in the circle. Roster seals when `seat_count == capacity`.
    pub capacity: u8,
    /// High-water mark of assigned member slots. Immutable once `Active`.
    /// NOT the number of people who currently owe or collect — use
    /// `active_count()` for that.
    pub seat_count: u8,
    /// Slot -> wallet. Slots `>= seat_count` are `Pubkey::default()`.
    /// Immutable once `Active` (ejection tombstones, never compacts).
    pub members: [Pubkey; MAX_MEMBERS],
    /// `rotation[p]` = member slot that collects at position `p` of the current
    /// rotation. Rebuilt and reshuffled from `live_mask()` at each rotation
    /// boundary in `open_cycle`.
    pub rotation: [u8; MAX_MEMBERS],
    /// Number of payout positions in the current rotation. Set to
    /// `active_count()` at each boundary; decremented when a not-yet-collected
    /// member is ejected mid-rotation.
    pub rotation_len: u8,
    /// Position within the current rotation. `rotation_pos == rotation_len`
    /// means the rotation is complete and the next `open_cycle` reshuffles.
    pub rotation_pos: u8,
    /// Total full rotations the members have agreed to. Grows on a sealed
    /// extension.
    pub rotations_target: u8,
    /// Completed rotations. Also the current rotation's 0-based index.
    pub rotations_done: u8,
    /// Rotations in a proposed-but-unsealed extension. `0` unless `Extending`.
    pub pending_rotations: u8,
    /// Tombstone bitmask over member slots. Bit `i` set = slot `i` is out of
    /// the circle (defaulted, or exited voluntarily).
    pub ejected: u16,
    /// `⊆ ejected`. Bit `i` set = slot `i` was ejected for missing a payment.
    pub defaulted: u16,
    /// Extension opt-ins, bitmask over member slots. Reset on propose/cancel.
    pub optin_mask: u16,
    /// Unix time the extension opt-in window closes.
    pub optin_deadline: i64,
    pub status: GroupStatus,
    /// Globally monotonic round counter. Never resets. This is the `Cycle` PDA
    /// seed, so it must stay unique across rotations.
    pub current_cycle: u16,
    /// Unix time the current cycle was opened.
    pub opened_at: i64,
}

impl Group {
    pub fn is_member(&self, key: &Pubkey) -> bool {
        self.member_index(key).is_some()
    }

    pub fn member_index(&self, key: &Pubkey) -> Option<usize> {
        self.members[..self.seat_count as usize]
            .iter()
            .position(|m| m == key)
    }

    /// Bitmask of every assigned seat.
    pub fn seat_mask(&self) -> u16 {
        ((1u32 << self.seat_count) - 1) as u16
    }

    /// Bitmask of seats still in the circle (assigned and not ejected).
    pub fn live_mask(&self) -> u16 {
        self.seat_mask() & !self.ejected
    }

    /// How many people currently owe a contribution and collect a payout.
    pub fn active_count(&self) -> u8 {
        self.live_mask().count_ones() as u8
    }

    pub fn is_live(&self, i: usize) -> bool {
        self.live_mask() & (1u16 << i) != 0
    }

    /// True when the current rotation has run to its end and the next
    /// `open_cycle` must rebuild and reshuffle `rotation`.
    pub fn at_rotation_boundary(&self) -> bool {
        self.rotation_pos == self.rotation_len
    }

    /// Deterministic Fisher–Yates shuffle of `rotation[0..len]`, which the
    /// caller has already filled with the live member slots in ascending order.
    ///
    /// Seeded from a recent slot hash mixed with the group PDA and salted with
    /// the rotation index + global cycle counter. The salt is load-bearing:
    /// without it a fresh rotation on a chain that has not advanced its slot
    /// hash (e.g. LiteSVM) would reproduce the previous permutation exactly.
    ///
    /// Anyone can recompute and verify the order, but no party chooses it.
    /// Documented limitation: whoever lands the boundary `open_cycle` chooses
    /// the slot hash and can grind it. Acceptable for a circle of people who
    /// know each other; surfaced honestly in the UI.
    pub fn shuffle(
        &mut self,
        group_key: &Pubkey,
        slot_hash: &[u8; 32],
        rotation_index: u8,
        current_cycle: u16,
        len: usize,
    ) {
        // Full group-key entropy, XOR-salted with this rotation's identity so a
        // chain that has not moved its slot hash still permutes differently.
        let mut salt = group_key.to_bytes();
        salt[0] ^= rotation_index;
        salt[1] ^= (current_cycle & 0xff) as u8;
        salt[2] ^= (current_cycle >> 8) as u8;

        let mut state = seed_u64(slot_hash, &salt);

        // Walk i from len-1 down to 1, swapping with a uniform j in 0..=i.
        for i in (1..len).rev() {
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
    /// Global cycle index; the `Cycle` PDA seed.
    pub index: u16,
    /// Which rotation this round belongs to (`= group.rotations_done` at open).
    pub rotation_index: u8,
    /// Member slot that collects this cycle: `group.members[recipient_index]`.
    pub recipient_index: u8,
    pub opened_at: i64,
    /// `= opened_at + group.cycle_secs`.
    pub deadline: i64,
    /// Base units gathered for this round: contributions plus any forfeited
    /// deposits credited by the crank.
    pub pooled: u64,
    /// Bitmask over member slots: bit `i` set = slot `i` has settled this
    /// round. The recipient's bit is pre-set at open (they owe nothing).
    pub contributed: u16,
    /// `= group.live_mask()` snapshotted at open — who is on the hook this
    /// round. Frozen for the life of the cycle.
    pub required: u16,
    /// Slots ejected by this round's crank. Audit trail; `⊆ required`.
    pub ejected_here: u16,
    pub disbursed: bool,
    /// Amount actually paid to the recipient.
    pub payout: u64,
}

impl Cycle {
    pub fn has_contributed(&self, member_index: usize) -> bool {
        self.contributed & (1u16 << member_index) != 0
    }

    pub fn mark_contributed(&mut self, member_index: usize) {
        self.contributed |= 1u16 << member_index;
    }

    /// Every required member has settled.
    pub fn fully_funded(&self) -> bool {
        self.contributed == self.required
    }

    /// Required members who have not settled.
    pub fn defaulters(&self) -> u16 {
        self.required & !self.contributed
    }

    /// How many members actually paid in (excludes the pre-set recipient bit).
    pub fn contributor_count(&self) -> u32 {
        (self.contributed & self.required & !(1u16 << self.recipient_index)).count_ones()
    }
}

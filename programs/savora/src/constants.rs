use anchor_lang::prelude::*;

/// Hard ceiling on circle size. Keeps `Group` a fixed, bounded account and lets
/// the per-cycle contribution set live in a single `u16` bitmask.
pub const MAX_MEMBERS: usize = 12;

/// Circle name, stored as fixed-width bytes and trimmed by the client.
pub const NAME_LEN: usize = 32;

/// Shortest allowed cycle length. Guards against a zero/immediate deadline.
pub const MIN_CYCLE_SECS: i64 = 60;

#[constant]
pub const GROUP_SEED: &[u8] = b"group";

#[constant]
pub const CYCLE_SEED: &[u8] = b"cycle";

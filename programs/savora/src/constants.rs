use anchor_lang::prelude::*;

/// Hard ceiling on circle size. Keeps `Group` a fixed, bounded account and lets
/// the per-cycle contribution set live in a single `u16` bitmask.
pub const MAX_MEMBERS: usize = 12;

/// Circle name, stored as fixed-width bytes and trimmed by the client.
pub const NAME_LEN: usize = 32;

/// Shortest allowed cycle length. Guards against a zero/immediate deadline.
pub const MIN_CYCLE_SECS: i64 = 60;

/// Longest allowed grace window. Bounds `deadline + grace_secs` against i64
/// overflow and keeps a circle from being frozen open indefinitely.
pub const MAX_GRACE_SECS: i64 = 30 * 86_400;

/// Below this many live members a circle can no longer function and collapses
/// to `Failed`.
pub const MIN_ACTIVE: u8 = 2;

/// Ceiling on the rotation target, at creation and after an extension.
pub const MAX_ROTATIONS: u8 = 24;

/// Bounds on the extension opt-in window.
pub const MIN_OPTIN_SECS: i64 = 3_600;
pub const MAX_OPTIN_SECS: i64 = 30 * 86_400;

#[constant]
pub const GROUP_SEED: &[u8] = b"group";

#[constant]
pub const CYCLE_SEED: &[u8] = b"cycle";

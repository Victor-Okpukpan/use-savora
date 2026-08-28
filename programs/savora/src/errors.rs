use anchor_lang::prelude::*;

#[error_code]
pub enum SavoraError {
    #[msg("Contribution, deposit, cycle length, grace, capacity, or rotations is out of range")]
    InvalidParams,
    #[msg("Group is not accepting members")]
    GroupNotForming,
    #[msg("Group is already full")]
    GroupFull,
    #[msg("Signer is already a member of this group")]
    AlreadyMember,
    #[msg("Signer is not a member of this group")]
    NotAMember,
    #[msg("The creator cannot leave their own group")]
    CreatorCannotLeave,
    #[msg("Group is not active")]
    GroupNotActive,
    #[msg("This cycle has already been paid out")]
    CycleAlreadyDisbursed,
    #[msg("This member has already contributed to this cycle")]
    AlreadyContributed,
    #[msg("Cycle is not fully funded and the grace window has not closed")]
    CycleNotReady,
    #[msg("Every agreed rotation is already complete")]
    RotationComplete,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("SlotHashes sysvar could not be read for the rotation shuffle")]
    SlotHashesUnavailable,
    #[msg("The contribution window for this cycle has closed")]
    ContributionWindowClosed,
    #[msg("This member has been ejected from the circle")]
    MemberEjected,
    #[msg("The circle has too few active members to continue")]
    CircleCollapsed,
    #[msg("The circle has not completed its agreed rotations")]
    NotCompleted,
    #[msg("The circle is not awaiting extension opt-ins")]
    NotExtending,
    #[msg("This member has already opted into the extension")]
    AlreadyOptedIn,
    #[msg("The extension opt-in window has closed")]
    OptInWindowClosed,
    #[msg("This position has already been closed")]
    AlreadyExited,
    #[msg("Deposits cannot be withdrawn while the circle is running")]
    CannotExitNow,
    #[msg("Only the circle creator can do this")]
    CreatorOnly,
    #[msg("The creator has withdrawn and can no longer extend the circle")]
    CreatorHasExited,
    #[msg("The recipient token account is not the canonical associated token account")]
    InvalidRecipientToken,
    #[msg("Mints with a transfer hook are not supported")]
    UnsupportedMint,
    #[msg("This circle still has members and cannot be closed")]
    GroupNotEmpty,
}

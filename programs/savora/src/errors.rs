use anchor_lang::prelude::*;

#[error_code]
pub enum SavoraError {
    #[msg("Contribution, cycle length, or capacity is out of range")]
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
    #[msg("Cycle is not fully funded and the deadline has not passed")]
    CycleNotReady,
    #[msg("The rotation for this group is already complete")]
    RotationComplete,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("SlotHashes sysvar could not be read for the rotation shuffle")]
    SlotHashesUnavailable,
}

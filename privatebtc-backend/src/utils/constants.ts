export const APY_RATES = {
    30: 0.06,   // 6% APY for 30 days
    60: 0.09,   // 9% APY for 60 days
    90: 0.12,   // 12% APY for 90 days
    180: 0.15,  // 15% APY for 180 days
    365: 0.18   // 18% APY for 365 days
} as const;

export const MIN_DEPOSIT_AMOUNT = 0.01; // 0.01 BTC
export const MAX_DEPOSIT_AMOUNT = 100;  // 100 BTC

export const VALID_LOCK_PERIODS = [30, 60, 90, 180, 365] as const;

export const VAULT_STATUS = {
    LOCKED: 'locked',
    UNLOCKED: 'unlocked',
    WITHDRAWN: 'withdrawn'
} as const;

export const TX_TYPES = {
    DEPOSIT: 'deposit',
    WITHDRAW: 'withdraw'
} as const;

export const ZK_PROOF_COMPUTATION_DELAY = 2000; // ms (simulates ZK proving time)

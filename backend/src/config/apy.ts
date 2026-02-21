/**
 * Protocol-defined APY rates for PrivateBTC Vault.
 * These are deterministic constants — not mock data.
 */

export const VALID_LOCK_DURATIONS = [30, 90, 365] as const;
export type LockDuration = (typeof VALID_LOCK_DURATIONS)[number];

export const APY_RATES: Record<LockDuration, number> = {
    30: 0.06,   // 6%
    90: 0.12,   // 12%
    365: 0.18,  // 18%
};

export function isValidLockDuration(days: number): days is LockDuration {
    return (VALID_LOCK_DURATIONS as readonly number[]).includes(days);
}

export function getApy(lockDurationDays: LockDuration): number {
    return APY_RATES[lockDurationDays];
}

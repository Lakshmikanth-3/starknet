/**
 * Privacy Constants — shared across backend
 *
 * ALLOWED_DENOMINATIONS_BTC: Fixed denominations (like Tornado Cash).
 *   All deposits MUST use one of these values so on-chain amounts can't
 *   be used to correlate a deposit with its withdrawal.
 *
 * MIN_ANONYMITY_SET: Minimum number of *unspent* commitments that must
 *   exist in the pool before a withdrawal is allowed.
 *   Below this threshold the withdrawal is trivially linkable.
 *   Dev default: 2 (low so you can test solo).
 *   Production recommendation: 5–10.
 */

export const ALLOWED_DENOMINATIONS_BTC = [0.0001, 0.001, 0.01, 0.1] as const;
export type AllowedDenomination = (typeof ALLOWED_DENOMINATIONS_BTC)[number];

export const ALLOWED_DENOMINATIONS_SATS = ALLOWED_DENOMINATIONS_BTC.map(
    (btc) => Math.round(btc * 1e8),
);

export const MIN_ANONYMITY_SET: number =
    parseInt(process.env.MIN_ANONYMITY_SET ?? '1', 10);

/** Returns true when the given BTC amount is a permitted denomination */
export function isAllowedDenomination(btcAmount: number): boolean {
    return ALLOWED_DENOMINATIONS_BTC.some(
        (d) => Math.abs(d - btcAmount) < 1e-12,
    );
}

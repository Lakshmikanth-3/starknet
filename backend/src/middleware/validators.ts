/**
 * Address & Type Validators — PrivateBTC Vault
 *
 * Provides granular validation for Starknet addresses, Bitcoin Signet addresses,
 * transaction amounts, and cryptographic felts.
 */

export const isValidStarknetAddress = (address: string): boolean => {
    return typeof address === 'string' && /^0x[0-9a-fA-F]{63,64}$/.test(address);
};

export const isValidBitcoinSignetAddress = (address: string): boolean => {
    // Bitcoin Signet (bech32) addresses typically start with 'tb1'
    return typeof address === 'string' && address.startsWith('tb1') && address.length >= 14 && address.length <= 74;
};

export const isValidAmount = (amount: string | number): boolean => {
    const num = Number(amount);
    return !isNaN(num) && isFinite(num) && num > 0;
};

export const isValidTimelock = (timelock: number): boolean => {
    const now = Math.floor(Date.now() / 1000);
    const tenYearsFromNow = now + (10 * 365 * 24 * 60 * 60);
    return typeof timelock === 'number' && timelock > now && timelock < tenYearsFromNow;
};

export const isValidPreimage = (preimage: string): boolean => {
    return typeof preimage === 'string' && preimage.length >= 1 && preimage.length <= 256;
};

export const isValidFelt = (value: string): boolean => {
    return typeof value === 'string' && (/^[0-9]+$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value));
};

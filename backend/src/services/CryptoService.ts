/**
 * CryptoService — Real cryptographic operations for PrivateBTC Vault.
 *
 * All hash functions use starknet.js so outputs exactly match
 * what Cairo contracts compute on-chain.
 *
 * !! NEVER generates tx_hash. That only comes from Starknet. !!
 */

import crypto from 'crypto';
import { hash, constants } from 'starknet';
import { config } from '../config/env';

// Alias correct starknet.js v6 API names
const computePedersen = hash.computePedersenHash;
const computePoseidon = hash.computePoseidonHash;

const STARK_FIELD_PRIME = constants.PRIME; // 2^251 + 17*2^192 + 1

export class CryptoService {
    // ─────────────────────────────────────────────────────────────────────
    // KEY MATERIAL
    // ─────────────────────────────────────────────────────────────────────

    /** 32 random bytes as hex string (64 chars). Per-vault salt. */
    static generateSalt(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate ZK randomness: 31 random bytes as BigInt, guaranteed
     * < STARK_FIELD_PRIME, returned as 0x-prefixed hex string.
     * This is the user's ZK secret — losing it means losing vault access.
     */
    static generateRandomness(): string {
        // 31 bytes = 248 bits, always < 2^251, so always valid felt252
        const bytes = crypto.randomBytes(31);
        const bigVal = BigInt('0x' + bytes.toString('hex'));
        // Extra safety: ensure < PRIME
        const prime = BigInt(STARK_FIELD_PRIME);
        const safe = bigVal % prime;
        return '0x' + safe.toString(16).padStart(62, '0');
    }

    // ─────────────────────────────────────────────────────────────────────
    // AMOUNT ENCRYPTION (AES-256-GCM + HKDF-SHA256)
    // ─────────────────────────────────────────────────────────────────────

    private static deriveKey(salt: string): Buffer {
        const keyMaterial = Buffer.from(config.ENCRYPTION_KEY, 'utf8');
        const saltBuf = Buffer.from(salt, 'hex');
        return Buffer.from(crypto.hkdfSync('sha256', keyMaterial, saltBuf, Buffer.alloc(0), 32));
    }

    /**
     * Encrypt amountSats using AES-256-GCM.
     * Output: base64(iv[12] + authTag[16] + ciphertext)
     */
    static encryptAmount(amountSats: bigint, salt: string): string {
        const key = this.deriveKey(salt);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const plaintext = amountSats.toString();
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();

        // Pack: iv (12) + authTag (16) + ciphertext
        const packed = Buffer.concat([iv, authTag, encrypted]);
        return packed.toString('base64');
    }

    /** Exact reverse of encryptAmount. */
    static decryptAmount(encryptedBase64: string, salt: string): bigint {
        const packed = Buffer.from(encryptedBase64, 'base64');
        const iv = packed.subarray(0, 12);
        const authTag = packed.subarray(12, 28);
        const ciphertext = packed.subarray(28);

        const key = this.deriveKey(salt);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString('utf8');

        return BigInt(decrypted);
    }

    // ─────────────────────────────────────────────────────────────────────
    // RANDOMNESS ENCRYPTION
    // ─────────────────────────────────────────────────────────────────────

    /** Encrypt the user's ZK randomness string for safe server-side storage. */
    static encryptRandomness(randomness: string, salt: string): string {
        const key = this.deriveKey(salt);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        const encrypted = Buffer.concat([
            cipher.update(randomness, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();

        const packed = Buffer.concat([iv, authTag, encrypted]);
        return packed.toString('base64');
    }

    /** Exact reverse of encryptRandomness. */
    static decryptRandomness(encryptedBase64: string, salt: string): string {
        const packed = Buffer.from(encryptedBase64, 'base64');
        const iv = packed.subarray(0, 12);
        const authTag = packed.subarray(12, 28);
        const ciphertext = packed.subarray(28);

        const key = this.deriveKey(salt);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString('utf8');
    }

    // ─────────────────────────────────────────────────────────────────────
    // STARKNET-COMPATIBLE HASHES
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Validate that a value (hex or decimal string) is within the Starknet felt252 field prime.
     * Throws an error if invalid.
     */
    static validateFelt252(val: string | bigint): string {
        try {
            const bigVal = BigInt(val);
            const prime = BigInt(STARK_FIELD_PRIME);
            if (bigVal < 0n || bigVal >= prime) {
                throw new Error('Value exceeds Starknet field prime (felt252 bounds)');
            }
            return bigVal.toString(16); // return valid hex string
        } catch (e: any) {
            if (e.message.includes('bounds')) throw e;
            throw new Error(`Invalid felt252 format: ${val}`);
        }
    }

    /**
     * Generate commitment using Pedersen hash: pedersen(satoshiString, secret)
     */
    static generateCommitment(amountBTC: string, secret: string): string {
        // Convert BTC to satoshis for felt252 compatibility
        const amountSats = Math.round(parseFloat(amountBTC) * 1e8).toString();

        if (isNaN(parseInt(amountSats))) {
            throw new Error(`Invalid amount: ${amountBTC}`);
        }

        console.log('[CryptoService] Hashing amount (sats):', amountSats, 'secret:', secret.slice(0, 10) + '...');

        const commitment = hash.computePedersenHash(amountSats, secret);
        console.log('[CryptoService] commitment_hash:', commitment);
        return commitment; // already 0x-prefixed hex
    }

    /**
     * Generate nullifier using Pedersen hash: pedersen(commitmentHash, secret)
     */
    static generateNullifier(commitmentHash: string, secret: string): string {
        const nullifier = hash.computePedersenHash(commitmentHash, secret);
        console.log('[CryptoService] nullifier_hash:', nullifier);
        return nullifier; // 0x-prefixed hex
    }

    // ─────────────────────────────────────────────────────────────────────
    // VERIFICATION (timing-safe)
    // ─────────────────────────────────────────────────────────────────────

    /** Recompute commitment and compare using timing-safe equality. */
    static verifyCommitment(
        amount: string,
        secret: string,
        commitment: string
    ): boolean {
        try {
            const expected = this.generateCommitment(amount, secret);
            // Normalize both to 32-byte buffers for timingSafeEqual
            const a = Buffer.from(BigInt(expected).toString(16).padStart(64, '0'), 'hex');
            const b = Buffer.from(BigInt(commitment).toString(16).padStart(64, '0'), 'hex');
            return crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    /** Recompute nullifier and compare using timing-safe equality. */
    static verifyNullifier(
        commitmentHash: string,
        secret: string,
        nullifierHash: string
    ): boolean {
        try {
            const expected = this.generateNullifier(commitmentHash, secret);
            const a = Buffer.from(BigInt(expected).toString(16).padStart(64, '0'), 'hex');
            const b = Buffer.from(BigInt(nullifierHash).toString(16).padStart(64, '0'), 'hex');
            return crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // UTILITY
    // ─────────────────────────────────────────────────────────────────────

    /** Validate Starknet address: 0x + 63-66 hex chars. */
    static isValidAddress(addr: string): boolean {
        return /^0x[0-9a-fA-F]{63,66}$/.test(addr);
    }
}

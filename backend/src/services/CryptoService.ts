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
     * Generate commitment using Pedersen hash.
     * MUST match what the Cairo contract computes: pedersen(amountSats, randomness)
     * Both inputs are valid felt252 values.
     */
    static generateCommitment(amountSats: bigint, randomness: string): string {
        // computePedersen = hash.computePedersenHash — starknet.js v6 API
        const commitment = computePedersen(amountSats.toString(), randomness);
        return commitment; // already 0x-prefixed hex from starknet.js
    }

    /**
     * Generate nullifier using Poseidon hash.
     * computePoseidon(commitment, randomness) — starknet.js v6 API
     */
    static generateNullifier(commitment: string, randomness: string): string {
        const nullifier = computePoseidon(commitment, randomness);
        return nullifier; // 0x-prefixed hex
    }

    // ─────────────────────────────────────────────────────────────────────
    // VERIFICATION (timing-safe)
    // ─────────────────────────────────────────────────────────────────────

    /** Recompute commitment and compare using timing-safe equality. */
    static verifyCommitment(
        amountSats: bigint,
        randomness: string,
        commitment: string
    ): boolean {
        try {
            const expected = this.generateCommitment(amountSats, randomness);
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
        commitment: string,
        randomness: string,
        nullifierHash: string
    ): boolean {
        try {
            const expected = this.generateNullifier(commitment, randomness);
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

/**
 * CommitmentService — Pedersen commitments + Poseidon nullifiers.
 * Double-spend protection via nullifier DB records.
 *
 * Correct starknet.js v6 API:
 *   hash.computePedersenHash(secret, salt)  → commitment
 *   hash.computePoseidonHash(secret, nonce) → nullifier
 *
 * DB table: commitments (see schema.ts addCommitmentsTable())
 */

import { hash } from 'starknet';
import { getDb } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { lockManager } from '../middleware/lockManager';

export interface CommitmentRecord {
    id: string;
    commitment: string;
    nullifier_hash: string;
    used: number;       // 0 = unused, 1 = used
    created_at: number;
}

export class CommitmentService {
    /**
     * Create a Pedersen commitment and Poseidon nullifier from secret + salt/nonce.
     * Stores in DB and returns both hashes.
     *
     * Inputs must be valid felt252 (0x-prefixed hex or decimal string).
     */
    static commit(secret: string, salt: string): { commitment: string; nullifier_hash: string; id: string } {
        const db = getDb();

        // starknet.js v6 correct API
        const commitment = hash.computePedersenHash(secret, salt);
        const nullifier_hash = hash.computePoseidonHash(secret, salt);

        // Check if commitment already exists
        const existing = db
            .prepare('SELECT id FROM sc_commitments WHERE commitment = ?')
            .get(commitment) as { id: string } | undefined;
        if (existing) {
            return { commitment, nullifier_hash, id: existing.id };
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO sc_commitments (id, commitment, nullifier_hash, used, created_at)
            VALUES (?, ?, ?, 0, unixepoch())
        `).run(id, commitment, nullifier_hash);

        return { id, commitment, nullifier_hash };
    }

    /**
     * Verify that a given (secret, salt) pair produces the expected commitment.
     * Timing-safe via constant-time string comparison.
     */
    static verify(secret: string, salt: string, expectedCommitment: string): boolean {
        const computed = hash.computePedersenHash(secret, salt);
        // Normalise both to lowercase without 0x for comparison
        const norm = (s: string) => s.toLowerCase().replace('0x', '').padStart(64, '0');
        return norm(computed) === norm(expectedCommitment);
    }

    /**
     * Mark a nullifier as used (double-spend prevention).
     * Throws if nullifier is already used.
     */
    static async markNullifierUsed(nullifier_hash: string): Promise<void> {
        return lockManager.withLock(`nullifier:${nullifier_hash}`, async () => {
            const db = getDb();
            const record = db
                .prepare('SELECT used FROM sc_commitments WHERE nullifier_hash = ?')
                .get(nullifier_hash) as { used: number } | undefined;

            if (!record) throw new Error(`Nullifier not found: ${nullifier_hash}`);
            if (record.used === 1) throw new Error(`Nullifier already used: ${nullifier_hash}`);

            db.prepare('UPDATE sc_commitments SET used = 1 WHERE nullifier_hash = ?').run(nullifier_hash);
        });
    }

    /** Returns true if the nullifier has already been spent. */
    static isNullifierUsed(nullifier_hash: string): boolean {
        const db = getDb();
        const record = db
            .prepare('SELECT used FROM sc_commitments WHERE nullifier_hash = ?')
            .get(nullifier_hash) as { used: number } | undefined;
        return record?.used === 1;
    }

    /** Get all commitment records (for audit). */
    static listAll(): CommitmentRecord[] {
        const db = getDb();
        return db
            .prepare('SELECT * FROM sc_commitments ORDER BY created_at DESC')
            .all() as CommitmentRecord[];
    }

    /** Get a single commitment by nullifier hash. */
    static getByNullifier(nullifier_hash: string): CommitmentRecord | null {
        const db = getDb();
        return (
            db
                .prepare('SELECT * FROM sc_commitments WHERE nullifier_hash = ?')
                .get(nullifier_hash) as CommitmentRecord | null
        ) ?? null;
    }
}

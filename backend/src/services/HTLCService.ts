/**
 * HTLCService — Hash Time Lock Contract logic (off-chain state, on-chain ready).
 *
 * Uses Poseidon hash for hashlock (matches Cairo contract).
 * Preimage is returned ONCE to the creator and NEVER stored in DB.
 *
 * DB table: htlcs (see schema.ts addHTLCTable())
 */

import crypto from 'crypto';
import { hash } from 'starknet';
import { getDb } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';
import { lockManager } from '../middleware/lockManager';

export interface HTLC {
    id: string;
    sender: string;
    receiver: string;
    amount: string;
    hashlock: string;
    timelock: number;     // unix timestamp (seconds)
    status: 'pending' | 'claimed' | 'refunded';
    created_at: number;
}

export interface CreateHTLCResult {
    htlcId: string;
    preimage: string;     // Give to receiver — NEVER stored in DB
    hashlock: string;
}

export class HTLCService {
    /**
     * Create a new HTLC.
     * @param sender    Starknet address of sender
     * @param receiver  Starknet address of receiver
     * @param amount    Amount in smallest unit (string to avoid bigint serialisation)
     * @param timelockSeconds  Lock duration in seconds from now (e.g. 1800 = 30 min)
     */
    static create(
        sender: string,
        receiver: string,
        amount: string,
        timelock: number
    ): CreateHTLCResult {
        const db = getDb();

        // Generate random preimage — 31 bytes so it fits in felt252
        const preimage = '0x' + crypto.randomBytes(31).toString('hex');

        // Poseidon hashlock: computePoseidonHash(preimage, '0') — matches Cairo contract
        const hashlock = hash.computePoseidonHash(preimage, '0');

        const id = uuidv4();

        db.prepare(`
            INSERT INTO htlcs (id, sender, receiver, amount, hashlock, timelock, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', unixepoch())
        `).run(id, sender, receiver, amount, hashlock, timelock);

        // Preimage is returned to caller, NEVER stored
        return { htlcId: id, preimage, hashlock };
    }

    /**
     * Claim an HTLC by providing the correct preimage.
     * Verifies: hash.computePoseidonHash(preimage, '0') === hashlock
     */
    static async claim(htlcId: string, preimage: string): Promise<{ success: true }> {
        return lockManager.withLock(`htlc:claim:${htlcId}`, async () => {
            const db = getDb();

            const htlc = db.prepare('SELECT * FROM htlcs WHERE id = ?').get(htlcId) as HTLC | undefined;
            if (!htlc) throw new Error('HTLC not found');
            if (htlc.status === 'claimed') throw new Error('Already claimed');
            if (htlc.status === 'refunded') throw new Error('Already refunded');

            // Verify preimage format before hashing to avoid BigInt conversion errors
            if (!/^[0-9]+$/.test(preimage) && !/^0x[0-9a-fA-F]+$/.test(preimage)) {
                throw new Error('Invalid preimage — format mismatch');
            }

            // Verify preimage
            const computed = hash.computePoseidonHash(preimage, '0');
            if (computed.toLowerCase() !== htlc.hashlock.toLowerCase()) {
                throw new Error('Invalid preimage — hashlock mismatch');
            }

            db.prepare('UPDATE htlcs SET status = ? WHERE id = ?').run('claimed', htlcId);
            return { success: true };
        });
    }

    /**
     * Refund an HTLC after timelock has expired.
     * Only sender can refund, only if not already claimed/refunded.
     */
    static async refund(htlcId: string, senderAddress: string): Promise<{ success: true }> {
        return lockManager.withLock(`htlc:refund:${htlcId}`, async () => {
            const db = getDb();

            const htlc = db.prepare('SELECT * FROM htlcs WHERE id = ?').get(htlcId) as HTLC | undefined;
            if (!htlc) throw new Error('HTLC not found');
            if (htlc.sender.toLowerCase() !== senderAddress.toLowerCase()) throw new Error('Not sender');
            if (htlc.status === 'claimed') throw new Error('Already claimed');
            if (htlc.status === 'refunded') throw new Error('Already refunded');

            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec < htlc.timelock) {
                throw new Error(`Timelock not expired — ${htlc.timelock - nowSec}s remaining`);
            }

            db.prepare('UPDATE htlcs SET status = ? WHERE id = ?').run('refunded', htlcId);
            return { success: true };
        });
    }

    /** Get full HTLC state by ID. */
    static getById(htlcId: string): HTLC | null {
        const db = getDb();
        return (db.prepare('SELECT * FROM htlcs WHERE id = ?').get(htlcId) as HTLC | null) ?? null;
    }

    /** List all HTLCs for a given sender or receiver address. */
    static listByAddress(address: string): HTLC[] {
        const db = getDb();
        return db
            .prepare('SELECT * FROM htlcs WHERE sender = ? OR receiver = ? ORDER BY created_at DESC')
            .all(address, address) as HTLC[];
    }
}

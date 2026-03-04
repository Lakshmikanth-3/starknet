/**
 * Withdrawal Authorization Service
 * 
 * Security Layer: Ensures Bitcoin withdrawals are only authorized AFTER
 * mBTC has been burned on Starknet. Prevents direct Bitcoin sends without
 * corresponding Starknet burn transactions.
 * 
 * Key Functions:
 * 1. Create authorization when Starknet withdrawal succeeds
 * 2. Verify authorization exists before sending Bitcoin
 * 3. Update authorization status after Bitcoin send
 * 4. Query pending authorizations for processor
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';

export interface WithdrawalAuthorization {
    id: string;
    vault_id: string;
    nullifier_hash: string;
    starknet_tx_hash: string;
    bitcoin_address: string;
    amount_sats: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: number;
    confirmed_at: number | null;
    bitcoin_txid: string | null;
    error_message: string | null;
}

export class WithdrawalAuthorizationService {
    /**
     * Create a new withdrawal authorization after Starknet burn
     * This is the ONLY way to authorize a Bitcoin withdrawal
     */
    static createAuthorization(params: {
        vaultId: string;
        nullifierHash: string;
        starknetTxHash: string;
        bitcoinAddress: string;
        amountSats: number;
    }): WithdrawalAuthorization {
        const id = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        // Validate Bitcoin address format (Signet testnet)
        if (!params.bitcoinAddress.startsWith('tb1')) {
            throw new Error('Invalid Bitcoin address - must be Signet testnet (starts with tb1)');
        }

        // Validate Starknet transaction hash format
        if (!params.starknetTxHash.startsWith('0x') || params.starknetTxHash.length < 34) {
            throw new Error('Invalid Starknet transaction hash');
        }

        // Prevent duplicate authorizations
        const existing = db.prepare(`
            SELECT id FROM withdrawal_authorizations 
            WHERE nullifier_hash = ? OR starknet_tx_hash = ?
        `).get(params.nullifierHash, params.starknetTxHash);

        if (existing) {
            throw new Error('Authorization already exists for this withdrawal');
        }

        db.prepare(`
            INSERT INTO withdrawal_authorizations (
                id, vault_id, nullifier_hash, starknet_tx_hash, 
                bitcoin_address, amount_sats, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(
            id, 
            params.vaultId, 
            params.nullifierHash, 
            params.starknetTxHash,
            params.bitcoinAddress, 
            params.amountSats, 
            now
        );

        console.log(`[WithdrawalAuth] ✅ Created authorization ${id} for ${params.amountSats} sats`);

        return this.getAuthorizationById(id)!;
    }

    /**
     * Get authorization by ID
     */
    static getAuthorizationById(id: string): WithdrawalAuthorization | null {
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations WHERE id = ?
        `).get(id) as WithdrawalAuthorization | null;
    }

    /**
     * Get authorization by nullifier hash
     */
    static getAuthorizationByNullifier(nullifierHash: string): WithdrawalAuthorization | null {
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations WHERE nullifier_hash = ?
        `).get(nullifierHash) as WithdrawalAuthorization | null;
    }

    /**
     * Get authorization by Starknet transaction hash
     */
    static getAuthorizationByStarknetTx(txHash: string): WithdrawalAuthorization | null {
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations WHERE starknet_tx_hash = ?
        `).get(txHash) as WithdrawalAuthorization | null;
    }

    /**
     * Get all pending authorizations (for withdrawal processor)
     */
    static getPendingAuthorizations(): WithdrawalAuthorization[] {
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations 
            WHERE status = 'pending' 
            ORDER BY created_at ASC
        `).all() as WithdrawalAuthorization[];
    }

    /**
     * Update authorization status
     */
    static updateStatus(
        id: string, 
        status: 'processing' | 'completed' | 'failed',
        bitcoinTxid?: string,
        errorMessage?: string
    ): void {
        const now = Math.floor(Date.now() / 1000);
        
        if (status === 'completed' && !bitcoinTxid) {
            throw new Error('Bitcoin TXID required for completed status');
        }

        const updates: string[] = ['status = ?'];
        const values: any[] = [status];

        if (status === 'completed') {
            updates.push('confirmed_at = ?', 'bitcoin_txid = ?');
            values.push(now, bitcoinTxid);
        }

        if (errorMessage) {
            updates.push('error_message = ?');
            values.push(errorMessage);
        }

        values.push(id); // WHERE clause

        db.prepare(`
            UPDATE withdrawal_authorizations 
            SET ${updates.join(', ')} 
            WHERE id = ?
        `).run(...values);

        console.log(`[WithdrawalAuth] Updated authorization ${id}: ${status}`);
    }

    /**
     * Verify authorization exists and is valid for Bitcoin send
     * CRITICAL: This must be called before ANY Bitcoin withdrawal
     */
    static verifyAuthorization(nullifierHash: string): {
        valid: boolean;
        authorization?: WithdrawalAuthorization;
        error?: string;
    } {
        const auth = this.getAuthorizationByNullifier(nullifierHash);

        if (!auth) {
            return { 
                valid: false, 
                error: 'No authorization found - withdrawal not authorized' 
            };
        }

        if (auth.status === 'completed') {
            return { 
                valid: false, 
                error: 'Authorization already used - Bitcoin already sent' 
            };
        }

        if (auth.status === 'failed') {
            return { 
                valid: false, 
                error: `Authorization failed previously: ${auth.error_message}` 
            };
        }

        // For retry attempts, check if authorization exists with 'processing' status
        if (auth.status !== 'pending' && auth.status !== 'processing') {
            return { 
                valid: false, 
                error: `Invalid authorization status: ${auth.status}` 
            };
        }

        return { valid: true, authorization: auth };
    }

    /**
     * Get authorization statistics 
     */
    static getStats(): {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    } {
        const result = db.prepare(`
            SELECT 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM withdrawal_authorizations
        `).get() as any;

        return result;
    }

    /**
     * Get authorizations for a specific vault
     */
    static getAuthorizationsByVaultId(vaultId: string): WithdrawalAuthorization[] {
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations 
            WHERE vault_id = ? 
            ORDER BY created_at DESC
        `).all(vaultId) as WithdrawalAuthorization[];
    }

    /**
     * Check if authorization is expired (older than 24 hours and still pending)
     * Can be used for cleanup/retry logic
     */
    static getExpiredAuthorizations(hours: number = 24): WithdrawalAuthorization[] {
        const expiryTime = Math.floor(Date.now() / 1000) - (hours * 3600);
        
        return db.prepare(`
            SELECT * FROM withdrawal_authorizations 
            WHERE status = 'pending' 
            AND created_at < ?
            ORDER BY created_at ASC
        `).all(expiryTime) as WithdrawalAuthorization[];
    }
}

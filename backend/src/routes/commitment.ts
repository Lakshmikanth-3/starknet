/**
 * Commitment Routes — Pedersen commitment + Poseidon nullifier API
 *
 * POST /api/commitment/create   — commit(secret, salt) → commitment + nullifier_hash
 * POST /api/commitment/verify   — verify that (secret, salt) → expectedCommitment
 * GET  /api/commitment/nullifiers — list all commitments (audit)
 * GET  /api/commitment/nullifier/:hash — check if a specific nullifier is used
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CommitmentService } from '../services/CommitmentService';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const commitmentRouter = Router();

// ─── ADDED POST /deposit endpoint ──────────────────────────────────────────────
const executeDepositStub = async (args: { commitment: string; amount: number }): Promise<string> => {
    // Generate a simulated transaction hash
    const chars = '0123456789abcdef';
    let hex = '';
    for (let i = 0; i < 62; i++) hex += chars[Math.floor(Math.random() * 16)];
    return `SIMULATED-0x${hex}`;
};

const depositSchema = z.object({
    vault_id: z.string().uuid(),
    commitment: z.string().startsWith('0x'),
    amount: z.number().positive(),
});

commitmentRouter.post('/deposit', strictLimiter, validateBody(['vault_id', 'commitment', 'amount']), async (req: Request, res: Response): Promise<void> => {
    try {
        const { vault_id, commitment, amount } = depositSchema.parse(req.body);

        // 1. Execute deposit against Vault contract via StarknetService (simulated stub)
        const txHash: string | undefined = await executeDepositStub({ commitment, amount });

        // 2. CRITICAL: reject if no hash returned
        if (!txHash || txHash.trim() === '') {
            console.error('[DEPOSIT] ERROR: No transaction hash returned from Starknet');
            res.status(502).json({
                error: 'Starknet transaction failed — no hash returned',
                code: 'TX_HASH_MISSING',
            });
            return;
        }

        console.log('[DEPOSIT] transaction_hash:', txHash);

        // 3. Insert into vaults table ONLY after confirming txHash exists
        import('../db/schema').then(dbModule => {
            const db = dbModule.default;
            try {
                db.prepare(
                    `INSERT INTO vaults (id, owner_address, commitment, encrypted_amount, salt, randomness_hint, lock_duration_days, created_at, unlock_at, status, deposit_tx_hash)
                     VALUES (?, 'dummy_owner', ?, ?, 'dummy_salt', 'dummy_hint', 30, ?, ?, 'pending', ?)`
                ).run(vault_id, commitment, amount.toString(), Date.now(), Date.now() + 86400, txHash);
            } catch (e: any) {
                if (e.message.includes('UNIQUE constraint')) {
                    db.prepare(`UPDATE vaults SET deposit_tx_hash = ?, status = 'pending' WHERE id = ?`).run(txHash, vault_id);
                } else {
                    throw e;
                }
            }
        }).catch(err => console.error("DB Error:", err));

        // 4. Return success shape
        res.status(200).json({
            transaction_hash: txHash,
            status: 'submitted',
            vault_id,
            timestamp: new Date().toISOString(),
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Deposit execution failed';
        console.error('[DEPOSIT] Exception:', message);
        res.status(500).json({ error: message });
    }
});

commitmentRouter.post('/create', strictLimiter, validateBody(['secret', 'amount']), (req: Request, res: Response): void => {
    try {
        const schema = z.object({
            secret: z.string().min(1, 'secret is required'),
            amount: z.string().min(1, 'amount is required'),
        });
        const { secret, amount } = schema.parse(req.body);

        // For MVP/Demo: Using stringified amount as the salt for the Pedersen hash
        const result = CommitmentService.commit(secret, amount);

        res.status(201).json({
            success: true,
            data: {
                id: result.id,
                commitment: result.commitment,
                nullifier_hash: result.nullifier_hash,
            },
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create commitment',
        });
    }
});

// ── Verify commitment ────────────────────────────────────────────────────────
commitmentRouter.post('/verify', strictLimiter, validateBody(['secret', 'salt', 'commitment']), (req: Request, res: Response): void => {
    try {
        const schema = z.object({
            secret: z.string().min(1),
            salt: z.string().min(1),
            commitment: z.string().min(1),
        });
        const { secret, salt, commitment } = schema.parse(req.body);

        const verified = CommitmentService.verify(secret, salt, commitment);

        res.json({ success: true, data: { verified } });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : 'Verification failed',
        });
    }
});

// ── List all (audit) ─────────────────────────────────────────────────────────
commitmentRouter.get('/nullifiers', (_req: Request, res: Response): void => {
    const all = CommitmentService.listAll();
    res.json({
        success: true,
        data: all.map(({ id, commitment, nullifier_hash, used, created_at }) => ({
            id, commitment, nullifier_hash, used: used === 1, created_at,
        })),
    });
});

// ── Check single nullifier ────────────────────────────────────────────────────
commitmentRouter.get('/nullifier/:hash', (req: Request, res: Response): void => {
    const nullifier_hash = req.params.hash;
    const record = CommitmentService.getByNullifier(nullifier_hash);
    if (!record) {
        res.json({ success: true, data: { found: false, used: false } });
        return;
    }
    res.json({
        success: true,
        data: {
            found: true,
            commitment: record.commitment,
            nullifier_hash: record.nullifier_hash,
            used: record.used === 1,
            created_at: record.created_at,
        },
    });
});

// methodNotAllowed for POST endpoints
commitmentRouter.all(['/create', '/verify'], methodNotAllowed);

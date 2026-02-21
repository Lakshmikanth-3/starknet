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

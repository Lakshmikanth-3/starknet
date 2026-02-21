/**
 * SHARP API Routes — PrivateBTC Vault
 *
 * Provides endpoints for ZK-proof submission and tracking.
 */

import { Router, Request, Response } from 'express';
import { SharpService } from '../services/SharpService';
import { sharpLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const sharpRouter = Router();

// ─── POST /api/sharp/submit ──────────────────────────────────────────────────
sharpRouter.post('/submit', sharpLimiter, validateBody(['secret', 'salt']), async (req: Request, res: Response) => {
    try {
        const { secret, salt } = req.body;

        if (!secret || !salt) {
            return res.status(400).json({
                success: false,
                error: 'Both "secret" and "salt" are required non-empty strings.',
            });
        }

        const { jobKey } = await SharpService.submitProof(secret.toString(), salt.toString());

        res.json({
            success: true,
            data: {
                jobKey,
                message: 'Proof submitted to SHARP for ZK-verification',
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error during SHARP submission',
        });
    }
});

// ─── GET /api/sharp/status/:jobKey ───────────────────────────────────────────
sharpRouter.get('/status/:jobKey', async (req: Request, res: Response) => {
    try {
        const { jobKey } = req.params;
        const { status, onChain } = await SharpService.checkProofStatus(jobKey);

        let message = '';
        switch (status) {
            case 'IN_PROGRESS':
                message = 'Prover is generating your STARK proof — please wait';
                break;
            case 'PROCESSED':
                message = 'Proof generated, awaiting on-chain verification';
                break;
            case 'ONCHAIN':
                message = '✅ Proof verified on-chain — commitment is ZK-proven!';
                break;
            case 'FAILED':
                message = '❌ Proof generation failed — check your Cairo logic';
                break;
            default:
                message = 'Current status of your proof job';
        }

        res.json({
            success: true,
            data: {
                jobKey,
                status,
                onChain,
                message,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error while checking status',
        });
    }
});

// ─── GET /api/sharp/history ───────────────────────────────────────────────────
sharpRouter.get('/history', async (_req: Request, res: Response) => {
    try {
        const proofs = await SharpService.getProofHistory();
        res.json({
            success: true,
            data: { proofs },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error fetching proof history',
        });
    }
});

// methodNotAllowed for POST endpoints
sharpRouter.all('/submit', methodNotAllowed);

export default sharpRouter;

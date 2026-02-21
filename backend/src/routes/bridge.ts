/**
 * Bitcoin Bridge API Routes — PrivateBTC Vault
 *
 * Provides endpoints for monitoring Bitcoin Signet activity.
 */

import { Router, Request, Response } from 'express';
import { BitcoinSignetService } from '../services/BitcoinSignetService';
import {
    isValidBitcoinSignetAddress,
    isValidAmount
} from '../middleware/validators';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const bridgeRouter = Router();

// ─── GET /api/bridge/btc-status ──────────────────────────────────────────────
bridgeRouter.get('/btc-status', async (_req: Request, res: Response) => {
    try {
        const block = await BitcoinSignetService.getCurrentBlock();
        res.json({
            success: true,
            data: {
                network: 'signet',
                currentBlock: block,
                status: 'synced'
            },
        });
    } catch (err) {
        res.status(503).json({
            success: false,
            error: err instanceof Error ? err.message : 'Bitcoin Signet API unavailable',
        });
    }
});

// ─── POST /api/bridge/watch-address ─────────────────────────────────────────
bridgeRouter.post('/watch-address', strictLimiter, validateBody(['address']), async (req: Request, res: Response) => {
    try {
        const { address } = req.body;

        if (!isValidBitcoinSignetAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Bitcoin Signet address. Must start with tb1',
            });
        }

        const stats = await BitcoinSignetService.watchAddress(address);

        res.json({
            success: true,
            data: stats,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to watch Bitcoin address',
        });
    }
});

// ─── POST /api/bridge/detect-lock ────────────────────────────────────────────
bridgeRouter.post('/detect-lock', strictLimiter, validateBody(['address', 'amountSats']), async (req: Request, res: Response) => {
    try {
        const { address, amountSats, simulate } = req.body;

        if (!isValidBitcoinSignetAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Bitcoin Signet address. Must start with tb1',
            });
        }

        if (!isValidAmount(amountSats)) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a positive number',
            });
        }

        // Real detection only - no simulator branch
        const detection = await BitcoinSignetService.detectLock(address, amountSats);

        res.json({
            success: true,
            data: {
                ...detection,
                address,
                expectedAmountSats: amountSats
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal error during lock detection',
        });
    }
});

// methodNotAllowed for POST endpoints
bridgeRouter.all(['/watch-address', '/detect-lock'], methodNotAllowed);

export default bridgeRouter;

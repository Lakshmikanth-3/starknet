/**
 * HTLC Routes — Hash Time Lock Contract API
 *
 * POST /api/htlc/create   — create HTLC, returns htlcId + preimage (preimage NOT stored)
 * POST /api/htlc/claim    — claim with preimage
 * POST /api/htlc/refund   — refund after timelock
 * GET  /api/htlc/status/:id — get HTLC state
 * GET  /api/htlc/list/:address — list HTLCs for address
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { HTLCService } from '../services/HTLCService';
import {
    isValidStarknetAddress,
    isValidAmount,
    isValidTimelock
} from '../middleware/validators';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const htlcRouter = Router();

// ── Create HTLC ─────────────────────────────────────────────────────────────
htlcRouter.post('/create', strictLimiter, validateBody(['sender', 'receiver', 'amount', 'timelockSeconds']), (req: Request, res: Response): void => {
    try {
        const schema = z.object({
            sender: z.string().min(1),
            receiver: z.string().min(1),
            amount: z.string().min(1),
            timelockSeconds: z.number().int().positive().default(1800),
        });
        const body = schema.parse(req.body);

        // Granular Domain Validation
        if (!isValidStarknetAddress(body.receiver)) {
            res.status(400).json({ success: false, error: 'Invalid receiver address' });
            return;
        }

        if (!isValidAmount(body.amount)) {
            res.status(400).json({ success: false, error: 'Amount must be a positive number' });
            return;
        }

        const timelock = Number(body.timelockSeconds);
        if (!isValidTimelock(timelock)) {
            res.status(400).json({ success: false, error: 'Timelock must be a future Unix timestamp' });
            return;
        }

        const result = HTLCService.create(
            body.sender,
            body.receiver,
            body.amount,
            timelock
        );

        res.status(201).json({
            success: true,
            data: {
                htlcId: result.htlcId,
                hashlock: result.hashlock,
                preimage: result.preimage,   // Give to receiver — expires after claim
                warning: 'Save the preimage — it will NOT be returned again.',
            },
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : 'Failed to create HTLC',
        });
    }
});

// ── Claim HTLC ───────────────────────────────────────────────────────────────
htlcRouter.post('/claim', strictLimiter, validateBody(['htlcId', 'preimage']), async (req: Request, res: Response) => {
    try {
        const schema = z.object({
            htlcId: z.string().min(1),
            preimage: z.string().min(1),
        });
        const { htlcId, preimage } = schema.parse(req.body);

        await HTLCService.claim(htlcId, preimage);

        res.json({ success: true, data: { status: 'claimed' } });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Claim failed';
        const status =
            msg.includes('Resource is locked') ? 409 :
                msg.includes('Already') ? 409 :
                    msg.includes('Invalid preimage') ? 401 :
                        msg.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, error: msg });
    }
});

// ── Refund HTLC ──────────────────────────────────────────────────────────────
htlcRouter.post('/refund', strictLimiter, validateBody(['htlcId']), async (req: Request, res: Response) => {
    try {
        const schema = z.object({
            htlcId: z.string().min(1),
            senderAddress: z.string().min(1),
        });
        const { htlcId, senderAddress } = schema.parse(req.body);

        await HTLCService.refund(htlcId, senderAddress);

        res.json({ success: true, data: { status: 'refunded' } });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Refund failed';
        const status =
            msg.includes('Resource is locked') ? 409 :
                msg.includes('Timelock not expired') ? 403 :
                    msg.includes('Already') ? 409 :
                        msg.includes('not found') ? 404 : 400;
        res.status(status).json({ success: false, error: msg });
    }
});

// ── Status ───────────────────────────────────────────────────────────────────
htlcRouter.get('/status/:id', (req: Request, res: Response): void => {
    const htlc = HTLCService.getById(req.params.id);
    if (!htlc) {
        res.status(404).json({ success: false, error: 'HTLC not found' });
        return;
    }
    // Never expose hashlock in status responses — only what's needed
    const { id, sender, receiver, amount, timelock, status, created_at } = htlc;
    const now = Math.floor(Date.now() / 1000);
    res.json({
        success: true,
        data: {
            id, sender, receiver, amount, timelock, status, created_at,
            timelockExpired: now >= timelock,
            secondsUntilExpiry: Math.max(0, timelock - now),
        },
    });
});

// ── List for address ─────────────────────────────────────────────────────────
htlcRouter.get('/list/:address', (req: Request, res: Response): void => {
    const htlcs = HTLCService.listByAddress(req.params.address);
    res.json({ success: true, data: htlcs });
});

// methodNotAllowed for POST endpoints
htlcRouter.all(['/create', '/claim', '/refund'], methodNotAllowed);

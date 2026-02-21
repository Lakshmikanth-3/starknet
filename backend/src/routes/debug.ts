/**
 * Debug routes — ONLY loaded in development.
 * NEVER exposed in production.
 */

import { Router, Request, Response } from 'express';
import db from '../db/schema';

const router = Router();

// ─── POST /api/debug/time-travel ──────────────────────────────────────────────
// Set a vault's unlock_at to the past so it can be withdrawn immediately.
router.post('/time-travel', (req: Request, res: Response) => {
    const { vaultId } = req.body as { vaultId: string };

    if (!vaultId) {
        res.status(400).json({ success: false, error: 'vaultId is required' });
        return;
    }

    const past = Math.floor(Date.now() / 1000) - 1;
    const result = db
        .prepare('UPDATE vaults SET unlock_at = ? WHERE id = ? AND status = ?')
        .run(past, vaultId, 'active');

    if (result.changes === 0) {
        res.status(404).json({
            success: false,
            error: 'Vault not found or not in active status',
        });
        return;
    }

    res.json({
        success: true,
        message: `Vault ${vaultId} time-travelled — unlock_at set to past`,
        newUnlockAt: past,
    });
});

// ─── GET /api/debug/vaults ────────────────────────────────────────────────────
router.get('/vaults', (_req: Request, res: Response) => {
    const vaults = db
        .prepare(`
      SELECT id, owner_address, commitment, status, lock_duration_days, 
             created_at, unlock_at, deposit_tx_hash
      FROM vaults ORDER BY created_at DESC LIMIT 50
    `)
        .all();

    res.json({ success: true, count: vaults.length, vaults });
});

export default router;

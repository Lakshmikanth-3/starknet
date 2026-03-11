/**
 * Debug routes — ONLY loaded in development.
 * NEVER exposed in production.
 */

import { Router, Request, Response } from 'express';
import db from '../db/schema';
import { WithdrawalAuthorizationService } from '../services/WithdrawalAuthorizationService';
import { BitcoinCovenantService } from '../services/BitcoinCovenantService';

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

// ─── GET /api/debug/authorizations ───────────────────────────────────────────
router.get('/authorizations', (_req: Request, res: Response) => {
    const auths = db.prepare(`
        SELECT * FROM withdrawal_authorizations ORDER BY created_at DESC LIMIT 20
    `).all();
    res.json({ success: true, count: auths.length, authorizations: auths });
});

// ─── GET /api/debug/covenant-status ──────────────────────────────────────────
router.get('/covenant-status', async (_req: Request, res: Response) => {
    try {
        const status = await BitcoinCovenantService.getCovenantStatus();
        res.json({ success: true, covenant: status });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/debug/force-withdrawal ────────────────────────────────────────
// Directly execute Bitcoin payout for a pending authorization.
// Bypasses Starknet RPC verification — safe because auth was only created
// after StarknetService.withdraw() succeeded.
router.post('/force-withdrawal', async (req: Request, res: Response) => {
    const { authId } = req.body as { authId: string };
    if (!authId) {
        res.status(400).json({ success: false, error: 'authId required' });
        return;
    }

    const auth = WithdrawalAuthorizationService.getAuthorizationById(authId);
    if (!auth) {
        res.status(404).json({ success: false, error: `Authorization ${authId} not found` });
        return;
    }
    if (auth.status === 'completed') {
        res.json({ success: true, message: 'Already completed', bitcoinTxid: auth.bitcoin_txid });
        return;
    }

    console.log(`[debug/force-withdrawal] Forcing payout for auth ${authId}`);
    console.log(`  → ${auth.amount_sats} sats to ${auth.bitcoin_address}`);

    try {
        WithdrawalAuthorizationService.updateStatus(authId, 'processing');
        const txid = await BitcoinCovenantService.executeCovenantWithdrawal(authId);
        WithdrawalAuthorizationService.updateStatus(authId, 'completed', txid);

        console.log(`[debug/force-withdrawal] ✅ Bitcoin sent! TXID: ${txid}`);

        res.json({
            success: true,
            bitcoinTxid: txid,
            explorerUrl: `https://mempool.space/signet/tx/${txid}`,
            message: `${auth.amount_sats} sats sent to ${auth.bitcoin_address}`,
        });
    } catch (err: any) {
        WithdrawalAuthorizationService.updateStatus(authId, 'pending');
        console.error(`[debug/force-withdrawal] Failed:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;

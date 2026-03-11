/**
 * Privacy Routes
 *
 * Exposes pool statistics needed by the frontend to:
 *  1. Show anonymity-set depth before committing a withdrawal
 *  2. Warn the user if the pool is too shallow for meaningful privacy
 *
 * GET /api/privacy/pool-stats
 */

import { Router, Request, Response } from 'express';
import db from '../db/schema';
import { ALLOWED_DENOMINATIONS_BTC, MIN_ANONYMITY_SET } from '../utils/privacyConstants';

export const privacyRouter = Router();

privacyRouter.get('/pool-stats', (_req: Request, res: Response): void => {
    // Count vaults that are 'active' (deposited) and whose nullifier has NOT yet been spent
    const row = db.prepare<[], {
        total_active: number;
        spent: number;
        unspent: number;
    }>(`
        SELECT
            COUNT(*) AS total_active,
            COUNT(CASE WHEN nullifier_hash IS NOT NULL
                            AND nullifier_hash IN (SELECT nullifier_hash FROM nullifiers)
                       THEN 1 END) AS spent,
            COUNT(CASE WHEN nullifier_hash IS NULL
                            OR nullifier_hash NOT IN (SELECT nullifier_hash FROM nullifiers)
                       THEN 1 END) AS unspent
        FROM vaults
        WHERE status = 'active'
    `).get()!;

    const anonymitySetSize = row.unspent;
    const withdrawalReady = anonymitySetSize >= MIN_ANONYMITY_SET;

    res.json({
        success: true,
        anonymitySetSize,
        totalActive: row.total_active,
        spentCommitments: row.spent,
        minRequired: MIN_ANONYMITY_SET,
        withdrawalReady,
        allowedDenominations: ALLOWED_DENOMINATIONS_BTC,
        message: withdrawalReady
            ? `Pool has ${anonymitySetSize} unspent commitments — safe to withdraw`
            : `Pool only has ${anonymitySetSize}/${MIN_ANONYMITY_SET} required unspent commitments. Withdrawing now would compromise privacy.`,
    });
});

export default privacyRouter;

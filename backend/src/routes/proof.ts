import { Router, Request, Response } from 'express';
import { verifyWithdrawProof } from '../services/ProofVerifier';

const router = Router();

// ─── POST /api/proof/verify-withdraw ─────────────────────────────────────────
router.post('/verify-withdraw', async (req: Request, res: Response) => {
    const { vaultId, randomness, ownerAddress } = req.body as {
        vaultId: string;
        randomness: string;
        ownerAddress: string;
    };

    if (!vaultId || !randomness || !ownerAddress) {
        res.status(400).json({
            success: false,
            error: 'Missing required fields: vaultId, randomness, ownerAddress',
        });
        return;
    }

    try {
        const result = await verifyWithdrawProof({ vaultId, randomness, ownerAddress });

        if (result.valid) {
            res.json({
                success: true,
                valid: true,
                checks: result.checks,
                proofToken: result.proofToken,
                message:
                    'All 9 checks passed. Use proofToken in POST /api/withdraw/execute.',
            });
        } else {
            res.status(400).json({
                success: false,
                valid: false,
                reason: result.reason,
                checks: result.checks,
            });
        }
    } catch (err) {
        console.error('verify-withdraw error:', err);
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : 'Internal server error',
        });
    }
});

export default router;

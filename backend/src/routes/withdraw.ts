import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';
import { StarknetService } from '../services/StarknetService';
import { validateTxHash } from '../middleware/validateTxHash';
import {
    TransactionNotFoundError,
    TransactionRevertedError,
} from '../types/errors';
import { config } from '../config/env';
import { strictLimiter } from '../middleware/rateLimiters';
import { validateBody } from '../middleware/validateBody';
import { methodNotAllowed } from '../middleware/methodNotAllowed';

export const withdrawRouter = Router();

// ─── POST /api/withdraw/execute ───────────────────────────────────────────────
withdrawRouter.post('/execute', strictLimiter, validateBody(['vaultId', 'proofToken', 'txHash']), validateTxHash, async (req: Request, res: Response) => {
    const { vaultId, proofToken, txHash } = req.body as {
        vaultId: string;
        proofToken: string;
        txHash: string;
    };

    try {
        // ── Verify JWT proof token ───────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const jwt = require('jsonwebtoken') as typeof import('jsonwebtoken');
        let tokenPayload: {
            vaultId: string;
            commitment: string;
            nullifierHash: string;
            ownerAddress: string;
        };

        try {
            tokenPayload = jwt.verify(proofToken, config.JWT_SECRET) as typeof tokenPayload;
        } catch (jwtErr) {
            res.status(401).json({
                success: false,
                error:
                    jwtErr instanceof jwt.TokenExpiredError
                        ? 'Proof token expired — please re-verify'
                        : 'Invalid proof token',
            });
            return;
        }

        if (tokenPayload.vaultId !== vaultId) {
            res.status(400).json({
                success: false,
                error: 'Proof token vaultId does not match request vaultId',
            });
            return;
        }

        const { commitment, nullifierHash, ownerAddress } = tokenPayload;

        // ── Load vault ───────────────────────────────────────────────────────
        const vault = db
            .prepare<
                [string],
                {
                    id: string;
                    status: string;
                    encrypted_amount: string;
                    withdraw_tx_hash: string | null;
                }
            >('SELECT id, status, encrypted_amount, withdraw_tx_hash FROM vaults WHERE id = ?')
            .get(vaultId);

        if (!vault) {
            res.status(404).json({ success: false, error: 'Vault not found' });
            return;
        }

        if (vault.status !== 'active') {
            res.status(400).json({
                success: false,
                error: `Vault is ${vault.status} — can only withdraw from active vault`,
            });
            return;
        }

        // ── Wait for tx to be confirmed on-chain ─────────────────────────────
        const receipt = await StarknetService.waitForTransaction(txHash);

        // ── Verify withdrawal event contains our nullifier ────────────────────
        const nullifierVerified = await StarknetService.verifyWithdrawalEvent(
            txHash,
            nullifierHash
        );

        if (!nullifierVerified) {
            res.status(400).json({
                success: false,
                error: 'Nullifier not found in withdrawal transaction on-chain',
                txHash,
                nullifierHash,
            });
            return;
        }

        // ── Atomic DB write ───────────────────────────────────────────────────
        const nowSecs = Math.floor(Date.now() / 1000);

        const insertNullifier = db.prepare(`
      INSERT INTO nullifiers (nullifier_hash, vault_id, used_at, withdraw_tx_hash)
      VALUES (?, ?, ?, ?)
    `);
        const updateVault = db.prepare(`
      UPDATE vaults
      SET status = 'withdrawn', withdraw_tx_hash = ?, nullifier_hash = ?
      WHERE id = ?
    `);
        const insertTx = db.prepare(`
      INSERT INTO transactions
        (id, vault_id, tx_hash, type, amount_encrypted, block_number,
         block_timestamp, execution_status, timestamp)
      VALUES (?, ?, ?, 'withdraw', ?, ?, ?, 'SUCCEEDED', ?)
    `);

        db.transaction(() => {
            insertNullifier.run(nullifierHash, vaultId, nowSecs, txHash);
            updateVault.run(txHash, nullifierHash, vaultId);
            insertTx.run(
                uuidv4(),
                vaultId,
                txHash,
                vault.encrypted_amount,
                receipt.block_number,
                0, // block_timestamp fetched lazily
                nowSecs
            );
        })();

        console.log(`✅ Withdrawal confirmed: ${vaultId} | nullifier: ${nullifierHash}`);

        res.json({
            success: true,
            txHash,
            blockNumber: receipt.block_number,
            nullifierHash,
            vaultId,
            ownerAddress,
        });
    } catch (err) {
        if (err instanceof TransactionNotFoundError) {
            res.status(404).json({ success: false, error: err.message });
        } else if (err instanceof TransactionRevertedError) {
            res.status(400).json({ success: false, error: err.message });
        } else {
            console.error('withdraw/execute error:', err);
            res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : 'Internal server error',
            });
        }
    }
});

// ─── GET /api/withdraw/check-nullifier/:nullifierHash ────────────────────────
withdrawRouter.get('/check-nullifier/:nullifierHash', async (req: Request, res: Response) => {
    const { nullifierHash } = req.params;

    const dbRow = db
        .prepare<
            [string],
            { nullifier_hash: string; used_at: number; withdraw_tx_hash: string; vault_id: string }
        >('SELECT * FROM nullifiers WHERE nullifier_hash = ?')
        .get(nullifierHash);

    let source: 'db' | 'chain' | 'both' | 'none' = 'none';
    const isUsedDb = !!dbRow;

    // Cross-check with on-chain commitment lookup
    let isUsedChain = false;
    if (dbRow) {
        const vaultRow = db
            .prepare<[string], { commitment: string }>('SELECT commitment FROM vaults WHERE id = ?')
            .get(dbRow.vault_id);
        if (vaultRow) {
            isUsedChain = await StarknetService.isCommitmentOnChain(vaultRow.commitment);
        }
    }

    if (isUsedDb && isUsedChain) source = 'both';
    else if (isUsedDb) source = 'db';
    else if (isUsedChain) source = 'chain';

    res.json({
        success: true,
        nullifierHash,
        isUsed: isUsedDb,
        usedAt: dbRow?.used_at,
        txHash: dbRow?.withdraw_tx_hash,
        source: source === 'none' ? 'none' : source,
    });
});

// ─── GET /api/withdraw/eligibility/:vaultId ───────────────────────────────────
withdrawRouter.get('/eligibility/:vaultId', async (req: Request, res: Response) => {
    const { vaultId } = req.params;

    const vault = db
        .prepare<
            [string],
            {
                id: string;
                unlock_at: number;
                status: string;
                commitment: string;
                nullifier_hash: string | null;
            }
        >(
            'SELECT id, unlock_at, status, commitment, nullifier_hash FROM vaults WHERE id = ?'
        )
        .get(vaultId);

    if (!vault) {
        res.status(404).json({ success: false, error: 'Vault not found' });
        return;
    }

    const nowSecs = Math.floor(Date.now() / 1000);
    const secondsRemaining = Math.max(0, vault.unlock_at - nowSecs);

    const nullifierUsed = vault.nullifier_hash
        ? !!db
            .prepare<[string], { nullifier_hash: string }>(
                'SELECT nullifier_hash FROM nullifiers WHERE nullifier_hash = ?'
            )
            .get(vault.nullifier_hash)
        : false;

    const onChainCommitmentActive = await StarknetService.isCommitmentOnChain(
        vault.commitment
    ).catch(() => false);

    res.json({
        success: true,
        vaultId,
        isUnlocked: secondsRemaining === 0,
        unlockAt: vault.unlock_at,
        secondsRemaining,
        nullifierUsed,
        onChainCommitmentActive,
        status: vault.status,
    });
});

// methodNotAllowed for POST endpoints
withdrawRouter.all('/execute', methodNotAllowed);

export default withdrawRouter;
